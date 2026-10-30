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

## Things to know

- **Everything is public.** Runpod's HTTP proxy has no login of its own. Sign-in is OpenSEO's accounts, and registration closes once the administrator exists.
- **Stopping saves money, not storage.** A stopped pod stops compute billing. The volume keeps billing, and the database is kept.
- **Terminating the pod keeps the volume.** Create a new pod with the same volume and the same start command to bring everything back. The address changes with the pod ID, so sign-in on the new address works once the app starts with it.
- **Requests time out at 100 seconds.** Long actions finish in the background, so reload the page to see results.
- **Scheduled work runs.** The built-in scheduler checks rank tracking and AI visibility every five minutes while the pod runs.
- **Secrets.** The session secret and the operator secret are generated on first start and stored in `/workspace/openseo`.
