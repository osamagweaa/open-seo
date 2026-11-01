import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import gate from "./index";

const POD = "https://pod1-3001.proxy.runpod.net";
const API = "https://api.runpod.io/v2/pods/pod1";

// A fake Runpod API, a fake pod behind its proxy, and in-memory storage.
function setup(
  options: {
    podStatus?: string;
    appUp?: boolean;
    actionResponse?: Response;
    lastActivity?: number;
    websocketUntil?: number;
    bootSeen?: number;
    /** Status the pod's proxy answers app requests with. */
    proxyStatus?: number;
    idleMinutes?: string;
  } = {},
) {
  const store = new Map<string, string>();
  if (options.lastActivity !== undefined) {
    store.set("last_activity", String(options.lastActivity));
  }
  if (options.bootSeen !== undefined) {
    store.set("boot_seen", String(options.bootSeen));
  }
  if (options.websocketUntil !== undefined) {
    store.set("websocket_until", String(options.websocketUntil));
  }
  const actions: string[] = [];
  const proxied: Request[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url === API) {
        return Response.json({ status: options.podStatus ?? "RUNNING" });
      }
      if (request.url === `${API}/action`) {
        const body = (await request.json()) as { action: string };
        actions.push(body.action);
        return options.actionResponse ?? Response.json({});
      }
      if (request.url === `${POD}/api/health`) {
        return new Response("", {
          status: options.appUp === false ? 502 : 200,
        });
      }
      proxied.push(request);
      return new Response("app", { status: options.proxyStatus ?? 200 });
    },
  );
  vi.stubGlobal("fetch", fetchMock);

  const pending: Promise<unknown>[] = [];
  const env = {
    RUNPOD_API_KEY: "key",
    POD_ID: "pod1",
    IDLE_MINUTES: options.idleMinutes,
    STATE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => void store.set(key, value),
      delete: async (key: string) => void store.delete(key),
    },
  } as unknown as Parameters<typeof gate.fetch>[1];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
  } as ExecutionContext;

  return {
    store,
    actions,
    proxied,
    fetchMock,
    visit: async (path: string, headers: Record<string, string> = {}) => {
      const response = await gate.fetch(
        new Request(`https://gate.example${path}`, {
          headers,
        }) as Parameters<typeof gate.fetch>[0],
        env,
        ctx,
      );
      await Promise.all(pending);
      return response;
    },
    runIdleCheck: async () => {
      await gate.scheduled({} as ScheduledController, env);
    },
  };
}

const BROWSER = { accept: "text/html" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runpod gate: visits", () => {
  it("proxies to the pod and records activity when the pod is ready", async () => {
    const t = setup();

    const response = await t.visit("/p/1/keywords?q=a", BROWSER);

    expect(response.status).toBe(200);
    expect(t.proxied[0]?.url).toBe(`${POD}/p/1/keywords?q=a`);
    expect(t.proxied[0]?.headers.get("x-forwarded-host")).toBe("gate.example");
    expect(t.store.has("last_activity")).toBe(true);
  });

  it("starts a stopped pod and shows a waiting page", async () => {
    const t = setup({ podStatus: "EXITED" });

    const response = await t.visit("/", BROWSER);

    expect(t.actions).toEqual(["start"]);
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("OpenSEO is starting");
    expect(t.store.has("last_activity")).toBe(true);
  });

  it("does not start a pod that is already starting", async () => {
    const t = setup({ podStatus: "PROVISIONING" });

    const response = await t.visit("/", BROWSER);

    expect(t.actions).toEqual([]);
    expect(response.status).toBe(503);
  });

  it("does not wake the pod for a favicon request", async () => {
    const t = setup({ podStatus: "EXITED" });

    const response = await t.visit("/favicon.ico");

    expect(t.actions).toEqual([]);
    expect(response.status).toBe(404);
  });

  it("shows why the pod could not start", async () => {
    const t = setup({
      podStatus: "EXITED",
      actionResponse: new Response("no capacity", { status: 500 }),
    });

    const response = await t.visit("/", BROWSER);

    expect(response.status).toBe(502);
    expect(await response.text()).toContain("no capacity");
  });

  it("reports ready on the status endpoint once the app answers", async () => {
    const t = setup();

    const response = await t.visit("/__gate/status");

    expect(await response.json()).toMatchObject({ state: "ready" });
  });
});

describe("runpod gate: wake rules", () => {
  it("shows the waiting page when a ready pod's proxy has nothing behind it", async () => {
    // Runpod answers for the old container just after a start.
    const t = setup({ proxyStatus: 502 });

    const response = await t.visit("/", BROWSER);

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("OpenSEO is starting");
  });

  it("does not wake the pod for background requests from a stale tab", async () => {
    const t = setup({ podStatus: "EXITED" });

    const response = await t.visit("/_serverFn/poll", { accept: "*/*" });

    expect(t.actions).toEqual([]);
    expect(response.status).toBe(503);
  });

  it("wakes the pod for an MCP client", async () => {
    const t = setup({ podStatus: "EXITED" });

    await t.visit("/mcp", { accept: "application/json, text/event-stream" });

    expect(t.actions).toEqual(["start"]);
  });

  it("counts a ready app seen by the status endpoint as activity", async () => {
    const before = Date.now() - 60 * 60_000;
    const t = setup({ lastActivity: before });

    await t.visit("/__gate/status");

    expect(Number(t.store.get("last_activity"))).toBeGreaterThan(before);
  });

  it("keeps the pod for a while after a WebSocket connects", async () => {
    const t = setup();

    await t.visit("/agents/sam-chat/s1", { ...BROWSER, upgrade: "websocket" });

    expect(Number(t.store.get("websocket_until"))).toBeGreaterThan(
      Date.now() + 20 * 60_000,
    );
  });

  it("wakes the pod for an OAuth token refresh from an MCP client", async () => {
    const t = setup({ podStatus: "EXITED" });

    await t.visit("/api/auth/oauth2/token", { accept: "*/*" });

    expect(t.actions).toEqual(["start"]);
  });
});

// Runs the waiting page's script against a fake status endpoint.
async function waitingPage(podState: string) {
  const t = setup({ podStatus: "EXITED" });
  const html = await (await t.visit("/", BROWSER)).text();
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1] ?? "";
  const reload = vi.fn();
  const message = { textContent: "" };
  const timers: Array<() => unknown> = [];
  let now = Date.now();
  runInNewContext(script, {
    fetch: async () => Response.json({ state: podState }),
    location: { reload },
    document: { getElementById: () => message },
    setTimeout: (callback: () => unknown) => void timers.push(callback),
    Date: { now: () => now },
  });
  return { reload, message, timers, wait: (ms: number) => void (now += ms) };
}

describe("runpod gate: waiting page", () => {
  it("tells the user to reload when the pod has stopped, instead of waking it again", async () => {
    const page = await waitingPage("stopped");

    await page.timers[0]?.();

    expect(page.reload).not.toHaveBeenCalled();
    expect(page.message.textContent).toContain("Reload");
    expect(page.timers).toHaveLength(1);
  });

  it("gives up with a message instead of polling forever", async () => {
    const page = await waitingPage("starting");
    page.wait(21 * 60_000);

    await page.timers[0]?.();

    expect(page.message.textContent).toContain("did not start");
    expect(page.timers).toHaveLength(1);
  });
});

describe("runpod gate: idle stop", () => {
  it("stops a running pod after the idle period", async () => {
    const t = setup({ lastActivity: Date.now() - 7 * 60_000 });

    await t.runIdleCheck();

    expect(t.actions).toEqual(["stop"]);
  });

  it("leaves the pod alone while there was recent traffic", async () => {
    const t = setup({ lastActivity: Date.now() - 2 * 60_000 });

    await t.runIdleCheck();

    expect(t.fetchMock).not.toHaveBeenCalled();
  });

  it("starts the idle clock on the first run instead of stopping", async () => {
    const t = setup();

    await t.runIdleCheck();

    expect(t.store.has("last_activity")).toBe(true);
    expect(t.actions).toEqual([]);
  });

  it("does not stop a pod that Runpod reports running while the app is still starting", async () => {
    const t = setup({ appUp: false, lastActivity: Date.now() - 8 * 60_000 });

    await t.runIdleCheck();

    expect(t.actions).toEqual([]);
  });

  it("stops a pod whose app never came up after the boot grace", async () => {
    const t = setup({ appUp: false, lastActivity: Date.now() - 25 * 60_000 });

    await t.runIdleCheck();

    expect(t.actions).toEqual(["stop"]);
  });

  it("waits out lagging activity writes before stopping", async () => {
    const t = setup({ lastActivity: Date.now() - 6 * 60_000 });

    await t.runIdleCheck();

    expect(t.actions).toEqual([]);
  });

  it("does not stop a pod in the minute after it was seen starting", async () => {
    // The status poll's activity write can lag behind the cron's read.
    const t = setup({
      lastActivity: Date.now() - 30 * 60_000,
      bootSeen: Date.now() - 60_000,
    });

    await t.runIdleCheck();

    expect(t.actions).toEqual([]);
  });

  it("remembers that it saw the pod starting", async () => {
    const t = setup({ appUp: false, lastActivity: Date.now() - 8 * 60_000 });

    await t.runIdleCheck();

    expect(t.store.has("boot_seen")).toBe(true);
  });

  it("stops an idle pod once a full window has passed since it was seen starting", async () => {
    const t = setup({
      lastActivity: Date.now() - 30 * 60_000,
      bootSeen: Date.now() - 8 * 60_000,
    });

    await t.runIdleCheck();

    expect(t.actions).toEqual(["stop"]);
  });

  it("leaves the pod alone while a WebSocket lease is open", async () => {
    const t = setup({
      lastActivity: Date.now() - 30 * 60_000,
      websocketUntil: Date.now() + 5 * 60_000,
    });

    await t.runIdleCheck();

    expect(t.actions).toEqual([]);
  });

  it("falls back to five minutes when IDLE_MINUTES is not a number", async () => {
    const t = setup({
      idleMinutes: "abc",
      lastActivity: Date.now() - 2 * 60_000,
    });

    await t.runIdleCheck();

    expect(t.actions).toEqual([]);
  });
});
