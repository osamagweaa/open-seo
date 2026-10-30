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
const NO_WAKE_PATHS =
  /^\/(favicon\.ico|robots\.txt|apple-touch-icon.*|sitemap\.xml)$/;

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
<body><main><h1>OpenSEO is starting</h1><p id="msg">Waking the server. This usually takes one to four minutes. This page refreshes by itself.</p></main>
<script>
async function poll() {
  try {
    const r = await fetch("/__gate/status", { cache: "no-store" });
    const s = await r.json();
    if (s.state === "ready") return location.reload();
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
      return statusResponse(await podState(env));
    }

    const memo = memory(env);
    if (Date.now() < memo.readyUntil) {
      const response = await proxy(request, env).catch(() => null);
      if (response && !POD_DOWN_STATUSES.has(response.status)) {
        recordActivity(env, ctx);
        return response;
      }
      memo.readyUntil = 0;
    }

    if (NO_WAKE_PATHS.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    let state = await podState(env);
    if (state.kind === "ready") {
      memo.readyUntil = Date.now() + READY_CACHE_MS;
      recordActivity(env, ctx, true);
      return proxy(request, env);
    }
    if (state.kind === "stopped") {
      state = await startPod(env);
      // Count the wake as activity so the idle check does not stop the pod
      // while it is still booting.
      recordActivity(env, ctx, true);
    }
    return waitingResponse(request, state);
  },

  async scheduled(_controller, env) {
    const idleMs = Number(env.IDLE_MINUTES ?? "5") * 60_000;
    const now = Date.now();
    const last = Number(await env.STATE.get(ACTIVITY_KEY));
    if (!last) {
      await env.STATE.put(ACTIVITY_KEY, String(now));
      return;
    }
    if (now - last < idleMs) return;

    const response = await runpod(env, "").catch(() => null);
    if (!response?.ok) return;
    const pod = (await response.json()) as { status?: string };
    if (pod.status !== "RUNNING") return;
    await runpod(env, "/action", {
      method: "POST",
      body: JSON.stringify({ action: "stop" }),
    });
  },
} satisfies ExportedHandler<Env>;
