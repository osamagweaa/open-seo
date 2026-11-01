# Runpod Self-Hosting

Run OpenSEO on a single Runpod CPU pod with email and password accounts. The pod clones this repository, builds the app on every start, and keeps its database on a network volume so it survives stops and restarts.

Expect about $0.08 per hour for a 2 vCPU pod with 8 GB of memory, plus about $0.70 per month for a 10 GB network volume. Prices change; check the Runpod console.

## Create it

1. Create a **network volume** of 10 GB in a data center that offers CPU pods, such as `EU-RO-1`.
2. Create a **CPU pod** in the same data center:
   - Flavor: General Purpose (`cpu3g`), 2 vCPU. The build needs about 8 GB of memory.
   - Image: `node:22`.
   - Attach the network volume at `/workspace`.
   - Expose HTTP port `3001`.
   - Container start command:

     ```bash
     /bin/bash -c "rm -rf /app && git clone --depth 1 --branch main https://github.com/osamagweaa/open-seo /app && cd /app && exec bash deploy/runpod/start.sh"
     ```

3. Wait for the pod to show **Running**, then watch its logs until the build finishes and the server starts. The first start takes several minutes.
4. Open `https://POD_ID-3001.proxy.runpod.net`. **Create the administrator account straight away.** The address is public, and the first visitor becomes the administrator until one exists.

## Add your DataForSEO key

Edit the pod and add the environment variable `DATAFORSEO_API_KEY` with the base64 of `login:password` (see [`DATAFORSEO_API_KEY.md`](./DATAFORSEO_API_KEY.md)). Saving resets the pod; the database stays on the volume. Other optional variables, such as `OPENROUTER_API_KEY`, work the same way.

## Start on demand and stop when idle

A small Cloudflare Worker (`scripts/runpod-gate`) sits in front of the pod. It is always on, free, and does three things:

- **Wakes the pod** when you open its address, and shows a waiting page that refreshes by itself.
- **Passes every request through** to the pod, including the live chat. Browser visits and agents using `/mcp` both count as activity.
- **Stops the pod** after 5 minutes without traffic. Change this with `IDLE_MINUTES` in `scripts/runpod-gate/wrangler.jsonc`.

Set it up once:

1. In the Runpod console, create an API key and keep it to yourself.
2. In GitHub, open Settings, Secrets and variables, Actions, and add `RUNPOD_API_KEY`, `CLOUDFLARE_API_TOKEN` (permissions: Workers Scripts edit, Workers KV Storage edit) and `CLOUDFLARE_ACCOUNT_ID`.
3. Run the **Deploy Runpod Gate** workflow from `main`. It prints the Worker address, such as `https://openseo-gate.YOUR-SUBDOMAIN.workers.dev`.
4. Edit the pod and add the environment variables `BETTER_AUTH_URL` (the Worker address) and `OPENSEO_SESSION_IDLE_MINUTES` (`5` logs you out after 5 idle minutes). Saving resets the pod.
5. From then on, use only the Worker address. Sign in again there; accounts and data are unchanged.

You can deploy from your own computer instead: `pnpm exec wrangler deploy -c scripts/runpod-gate/wrangler.jsonc`, then `pnpm exec wrangler secret put RUNPOD_API_KEY -c scripts/runpod-gate/wrangler.jsonc`.

What to expect:

- **A wake takes several minutes.** Runpod itself took about 3.5 minutes to resume a stopped pod in testing, before the app started. The app then rebuilds if the code changed since the last start, because the saved build is keyed by commit. An in-place restart without a code change took 111 seconds. Expect roughly 4 to 10 minutes.
- **Scheduled checks pause.** Rank tracking and AI visibility checks run only while the pod is up.
- **Stopping ends running work.** A site audit still running when the pod stops is lost, so keep the tab open until it finishes.
- **Anyone can wake the pod.** The Worker address is public and a visit starts the pod, which costs a few cents. The app login still protects your data.
- **Use the Worker address only.** The Worker stops a pod that gets no traffic through it, even if you are using the pod's own address or the Runpod console.
- **A recreated pod has a new id.** Update `POD_ID` in `scripts/runpod-gate/wrangler.jsonc` and redeploy.

## Things to know

- **Everything is public.** Runpod's HTTP proxy has no login of its own. Sign-in is OpenSEO's accounts, and registration closes once the administrator exists.
- **Stopping saves money, not storage.** A stopped pod stops compute billing. The volume keeps billing, and the database is kept. With the Worker above, this happens by itself.
- **Terminating the pod keeps the volume.** Create a new pod with the same volume and the same start command to bring everything back. The address changes with the pod ID, so sign-in on the new address works once the app starts with it.
- **Requests time out at 100 seconds.** Long actions finish in the background, so reload the page to see results.
- **Scheduled work runs.** The built-in scheduler checks rank tracking and AI visibility every five minutes while the pod runs.
- **Secrets.** The session secret and the operator secret are generated on first start and stored in `/workspace/openseo`.
