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
  } = {},
) {
  const store = new Map<string, string>();
  if (options.lastActivity !== undefined) {
    store.set("last_activity", String(options.lastActivity));
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
      return new Response("app", { status: 200 });
    },
  );
  vi.stubGlobal("fetch", fetchMock);

  const pending: Promise<unknown>[] = [];
  const env = {
    RUNPOD_API_KEY: "key",
    POD_ID: "pod1",
    STATE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => void store.set(key, value),
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

describe("runpod gate: idle stop", () => {
  it("stops a running pod after the idle period", async () => {
    const t = setup({ lastActivity: Date.now() - 6 * 60_000 });

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
});
