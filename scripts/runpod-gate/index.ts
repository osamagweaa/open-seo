// Always-on front door for the OpenSEO Runpod pod. It wakes a stopped pod when
// someone visits, shows a waiting page until the app answers, proxies every
// request to the pod (including WebSockets), and stops the pod after it has
// been idle. Deploy with scripts/runpod-gate/wrangler.jsonc; see
// docs/SELF_HOSTING_RUNPOD.md.

interface Env {
  /** Runpod API key. Set as a Worker secret. */
  RUNPOD_API_KEY: string;
  POD_ID: string;
  POD_PORT?: string;
  /** Minutes without traffic before the pod is stopped. Default 5. */
  IDLE_MINUTES?: string;
  RUNPOD_API_BASE?: string;
  /** Holds the time of the last request. */
  STATE: KVNamespace;
}

type PodState =
  | { kind: "ready" }
  | { kind: "starting" }
  | { kind: "stopped" }
  | { kind: "error"; message: string };

const ACTIVITY_KEY = "last_activity";
// Writes to KV are limited, so record activity at most this often.
const ACTIVITY_WRITE_INTERVAL_MS = 30_000;
// After a successful proxied request, skip the Runpod API lookup for this long.
const READY_CACHE_MS = 20_000;
// Statuses the Runpod proxy answers with when nothing is listening behind it.
const POD_DOWN_STATUSES = new Set([502, 503, 504]);
// Activity writes can reach the idle check late (the per-isolate throttle plus
// KV lag), so the stop waits this much longer than IDLE_MINUTES.
const IDLE_SLACK_MS = ACTIVITY_WRITE_INTERVAL_MS + 60_000;
// Runpod reports RUNNING minutes before the app answers (a cold build took about
// 10 minutes). A pod that has not answered for this long after the last visit is
// stopped anyway, so a crashed app cannot bill forever.
const BOOT_GRACE_MS = 20 * 60_000;
// A WebSocket (the live chat) sends no further HTTP requests, so connecting
// counts as activity for this long.
const WEBSOCKET_KEY = "websocket_until";
const WEBSOCKET_LEASE_MS = 30 * 60_000;
// The cron notes each minute that it sees the pod starting. Right after the app
// comes up, the activity write from the waiting page may not have reached the
// cron yet, so the stop also waits a full idle window after this note.
const BOOT_KEY = "boot_seen";
const NO_WAKE_PATHS =
  /^\/(favicon\.ico|robots\.txt|apple-touch-icon.*|sitemap\.xml)$/;

// Only a person opening a page or an MCP client starts the pod. Background
// requests from a stale tab and scanners probing this public address do not.
const MCP_PATHS = /^\/(mcp|\.well-known|api\/auth\/oauth2)(\/|$)/;
function canWake(request: Request, pathname: string) {
  return (
    (request.headers.get("accept") ?? "").includes("text/html") ||
    MCP_PATHS.test(pathname) ||
    request.headers.has("x-api-key") ||
    request.headers.has("authorization")
  );
}

type Memory = { readyUntil: number; lastActivityWrite: number };
const memoryByKv = new WeakMap<KVNamespace, Memory>();

function memory(env: Env): Memory {
  let value = memoryByKv.get(env.STATE);
  if (!value) {
    value = { readyUntil: 0, lastActivityWrite: 0 };
    memoryByKv.set(env.STATE, value);
  }
  return value;
}

function podOrigin(env: Env) {
  return `https://${env.POD_ID}-${env.POD_PORT ?? "3001"}.proxy.runpod.net`;
}

function runpod(env: Env, path: string, init?: RequestInit) {
  const base = env.RUNPOD_API_BASE ?? "https://api.runpod.io/v2";
  return fetch(`${base}/pods/${env.POD_ID}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      "content-type": "application/json",
    },
  });
}

async function errorMessage(response: Response) {
  const text = (await response.text().catch(() => "")).slice(0, 200);
  return `Runpod answered ${response.status}${text ? `: ${text}` : ""}`;
}

async function podState(env: Env): Promise<PodState> {
  const response = await runpod(env, "").catch(() => null);
  if (!response) return { kind: "error", message: "Runpod did not answer." };
  if (!response.ok) {
    return { kind: "error", message: await errorMessage(response) };
  }
  const pod = (await response.json()) as { status?: string };
  switch (pod.status) {
    case "RUNNING": {
      const health = await fetch(`${podOrigin(env)}/api/health`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      return health?.ok ? { kind: "ready" } : { kind: "starting" };
    }
    case "PROVISIONING":
    case "STARTING":
      return { kind: "starting" };
    case "EXITED":
      return { kind: "stopped" };
    default:
      return {
        kind: "error",
        message: `The pod is in state ${pod.status ?? "unknown"}.`,
      };
  }
}

async function startPod(env: Env): Promise<PodState> {
  const response = await runpod(env, "/action", {
    method: "POST",
    body: JSON.stringify({ action: "start" }),
  }).catch(() => null);
  if (!response) return { kind: "error", message: "Runpod did not answer." };
  // 409 means the pod is already moving toward running.
  if (response.ok || response.status === 409) return { kind: "starting" };
  return { kind: "error", message: await errorMessage(response) };
}

function proxy(request: Request, env: Env) {
  const url = new URL(request.url);
  const proxied = new Request(
    `${podOrigin(env)}${url.pathname}${url.search}`,
    request,
  );
  proxied.headers.set("x-forwarded-host", url.host);
  proxied.headers.set("x-forwarded-proto", "https");
  // Redirects belong to the browser; they point at this Worker's address.
  return fetch(proxied, { redirect: "manual" });
}

function recordActivity(env: Env, ctx: ExecutionContext, force = false) {
  const memo = memory(env);
  const now = Date.now();
  if (!force && now - memo.lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }
  memo.lastActivityWrite = now;
  ctx.waitUntil(env.STATE.put(ACTIVITY_KEY, String(now)));
}

function recordWebSocket(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return;
  ctx.waitUntil(
    env.STATE.put(WEBSOCKET_KEY, String(Date.now() + WEBSOCKET_LEASE_MS)),
  );
}

// Proxies to the pod, or returns null when nothing answers behind Runpod's proxy.
async function proxyToPod(request: Request, env: Env, ctx: ExecutionContext) {
  const response = await proxy(request, env).catch(() => null);
  if (!response || POD_DOWN_STATUSES.has(response.status)) {
    memory(env).readyUntil = 0;
    return null;
  }
  recordActivity(env, ctx);
  recordWebSocket(request, env, ctx);
  return response;
}

function statusResponse(state: PodState) {
  return Response.json(
    { state: state.kind, message: state.kind === "error" ? state.message : "" },
    { headers: { "cache-control": "no-store" } },
  );
}

const WAITING_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenSEO is starting</title>
<style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f0f0f0;color:#1a1a1a}main{max-width:26rem;padding:1.5rem;text-align:center}p{color:#555}</style></head>
<body><main><h1>OpenSEO is starting</h1><p id="msg">Waking the server. This usually takes several minutes. This page refreshes by itself.</p></main>
<script>
const started = Date.now();
async function poll() {
  if (Date.now() - started > 20 * 60 * 1000) {
    document.getElementById("msg").textContent = "OpenSEO did not start in time. Reload this page to try again.";
    return;
  }
  try {
    const r = await fetch("/__gate/status", { cache: "no-store" });
    const s = await r.json();
    if (s.state === "ready") return location.reload();
    if (s.state === "stopped") {
      document.getElementById("msg").textContent = "The server stopped. Reload this page to start it again.";
      return;
    }
    if (s.state === "error") {
      document.getElementById("msg").textContent = "The server could not be started. " + s.message;
      return;
    }
  } catch {}
  setTimeout(poll, 4000);
}
setTimeout(poll, 4000);
</script></body></html>`;

function waitingResponse(request: Request, state: PodState) {
  const headers = { "retry-after": "5", "cache-control": "no-store" };
  if (state.kind === "error") {
    return new Response(`The server could not be started. ${state.message}`, {
      status: 502,
      headers,
    });
  }
  if (state.kind === "stopped") {
    return new Response(
      "OpenSEO is stopped. Open it in a browser to start it.",
      {
        status: 503,
        headers,
      },
    );
  }
  const wantsHtml = request.headers.get("accept")?.includes("text/html");
  if (wantsHtml) {
    return new Response(WAITING_PAGE, {
      status: 503,
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response("OpenSEO is starting. Retry in a few seconds.", {
    status: 503,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/__gate/status") {
      const state = await podState(env);
      // A waiting page that sees the app come up is about to load it. Count that
      // now so the idle check cannot stop the pod in between.
      if (state.kind === "ready") recordActivity(env, ctx, true);
      return statusResponse(state);
    }

    const memo = memory(env);
    if (Date.now() < memo.readyUntil) {
      const response = await proxyToPod(request, env, ctx);
      if (response) return response;
    }

    if (NO_WAKE_PATHS.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    let state = await podState(env);
    if (state.kind === "ready") {
      memo.readyUntil = Date.now() + READY_CACHE_MS;
      recordActivity(env, ctx, true);
      // Just after a start, Runpod's proxy can still answer for the old
      // container, so a pod that reads ready may refuse the request.
      return (
        (await proxyToPod(request, env, ctx)) ??
        waitingResponse(request, { kind: "starting" })
      );
    }
    if (state.kind === "stopped" && canWake(request, url.pathname)) {
      state = await startPod(env);
      // Count the wake as activity so the idle check does not stop the pod
      // while it is still booting.
      recordActivity(env, ctx, true);
    }
    return waitingResponse(request, state);
  },

  async scheduled(_controller, env) {
    const minutes = Number(env.IDLE_MINUTES);
    const idleMs =
      (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60_000;
    const now = Date.now();
    const last = Number(await env.STATE.get(ACTIVITY_KEY));
    if (!last) {
      await env.STATE.put(ACTIVITY_KEY, String(now));
      return;
    }
    const websocketUntil = Number(await env.STATE.get(WEBSOCKET_KEY));
    if (now < websocketUntil || now - last < idleMs + IDLE_SLACK_MS) return;

    const bootSeen = Number(await env.STATE.get(BOOT_KEY));
    const state = await podState(env);
    if (state.kind === "stopped" || state.kind === "error") return;
    // A pod that is still starting is left alone until the boot grace is over.
    if (state.kind === "starting" && now - last < BOOT_GRACE_MS) {
      await env.STATE.put(BOOT_KEY, String(now));
      return;
    }
    if (state.kind === "ready" && now - bootSeen < idleMs + IDLE_SLACK_MS)
      return;
    await runpod(env, "/action", {
      method: "POST",
      body: JSON.stringify({ action: "stop" }),
    });
    await env.STATE.delete(BOOT_KEY);
  },
} satisfies ExportedHandler<Env>;
