# active-memory handoff: open-seo fork (self-host on Runpod)

**Handoff #1, revised 2026-11-01** · 2026-10-30 · Lineage: #1 (2026-10-30): decoupled the fork from upstream, fixed Docker standalone gaps, opened PR #1, deployed to a Runpod pod, user created the admin account, blocked on the DataForSEO key. Revision 2 (2026-11-01): built the Cloudflare gate Worker, answered the Google tools question, tested stopping and starting the pod, stopped the idle pod.

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: None active. If the user types /amcodeword, start every reply with the phrase they choose (default "Yes Boss!").
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission

- **Goal:** Make the fork `osamagweaa/open-seo` an end-to-end working, self-hosted SEO tool that runs on the user's own infrastructure with no dependency on the upstream maintainer's accounts.
- **Done looks like:** The app is deployed, the user signs in, and the SEO data features return real data from their own DataForSEO key.
- **Why it matters / context:** The user pays for their own infrastructure and data. The user has Runpod credit and does not use Cloudflare.
- **New requirement, added after the first handoff was written (user's words):** "It should be automatically, like when I open the, when I access my admin account, it start running. If when I, when it's stale, ideal, and should be logged out automatically after 5 minutes or maybe more, less. And when it logged out, the pod should be stopped running automatically." Meaning: the pod starts when the user opens the app, the app logs the user out after idle time (about 5 minutes, adjustable), and the pod then stops by itself. Not built yet.
- **Latest question (2026-11-01, answered):** "Does it have keywords optimization, trends ? Can we connect it with Google search console and Google trends and other Google tools for e-commerce". See the capability table in section 8. The user has not chosen a next feature.

## 2. About the user (as relevant to this work)

- Osama. Runs a one-person business and works with Claude as chief of staff and execution engine. GitHub login: `osamagweaa`.
- Final executor: Osama performs the last human click (accounts, payments, keys). Claude does the heavy lifting.
- Has a Runpod account with credit, connected to Claude as an MCP server. Does not use Cloudflare.
- Created the admin account on the deployed app himself.

## 3. Style & communication

- **Language:** English.
- **Tone:** Direct, candid, engineering-centric, objective.
- **Reply length:** Short. Lead with the answer or outcome in the first sentence. No explanation of what code does unless asked.
- **Formatting:** Dense markdown, short bullets, tables for data. No emojis and no decorative formatting.
- **Working style:** Results over tasks. Verify outcomes, not triggers. Do not ask permission for reversible work that follows from the request. Show evidence, such as screenshots, when asked what something looks like.
- **Avoid:** Greetings, pleasantries, closing offers, summaries of your own performance, reminders of constraints.

## 4. Hard rules (word for word)

1. "Zero Conversational Overhead: Skip all greetings, pleasantries, transitions, reminders of constraints, summaries of your own performance, or polite closing remarks"
2. "Lead with Value: Deliver the direct answer, core entity, or executable code block in the very first sentence or line of the response."
3. "Avoid any decorative formatting elements or emojis."
4. "Cap: 3 action items per session. Depth over breadth."
5. "Verify outcomes, not triggers. A fix or automation is "verified" only when the actual data/result is confirmed end-to-end"
6. "Never assume an integration worked — verify the end result"
7. "Log everything back to the changelog at session end, including what was NOT finished."
8. Repo rules live in `AGENTS.md` and load automatically. Key ones: PR descriptions use the `simple-issue-description` format; changes to `AGENTS.md`, `.github/**`, `.agents/skills/**` need explicit maintainer review; never put secrets in the repo.
9. Git: develop only on branch `claude/modest-maxwell-ry8qh2`; push with `git push -u origin <branch>`; create PRs as drafts; follow the attribution lines in the session's system reminder.
10. Runpod: state the hourly price before creating anything billable. Only stop, update or delete resources this conversation created or the user names.
11. Never ask the user to paste secrets into chat. Keys go into the Runpod pod settings.

## 5. Corrections log

| #   | Claude did                                                         | The user wanted                                                                                                                    |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Started a local rehearsal of the pod start script before deploying | "You have MCP connected to RAM pod, just in case you didn't know." Use the connected Runpod tools directly; skip local rehearsals. |
| 2   | Reported the live page in words only                               | "Open the page, let me see what are you seeing." Show screenshots with SendUserFile.                                               |

## 6. Decisions

| Decision                                                                                       | Why                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Target is a self-hosted instance, not a hosted SaaS                                            | User's choice at planning                                                                                    |
| Branding: decouple only, keep the OpenSEO name                                                 | User's choice at planning                                                                                    |
| Deploy on a Runpod CPU pod, not Cloudflare                                                     | User has Runpod credit and does not use Cloudflare                                                           |
| Single pod runs the repo's existing single-container flow in `AUTH_MODE=password`              | The multi-container Docker edition does not fit one pod; password mode gives real sign-in on a public URL    |
| State lives on a network volume at `/workspace`                                                | CPU pods cannot use a local persistent disk; container disk is wiped on stop or restart                      |
| Secrets are generated on first start and kept on the volume                                    | Keeps them out of pod config and chat                                                                        |
| Telemetry is opt-in via `OPENSEO_TELEMETRY_POSTHOG_KEY`                                        | Upstream's PostHog key was removed from the source                                                           |
| Docker standalone gaps are fixed in code                                                       | User asked: "fix the docker standalone gaps too"                                                             |
| `GOOGLE_MAPS_API_KEY` and `CRAWLER_ACCESS_SECRET` are passed through the Docker env            | Matches how other optional credentials work                                                                  |
| Skill files, the SAM fact sheet and hosted-only screens are left unchanged                     | Review control plane and hosted-only code                                                                    |
| Wake and stop through a Cloudflare Worker, `scripts/runpod-gate`                               | User's decision: "Use the Cloudflare worker and stop the pod after 5 minutes ideal."                         |
| Idle means no traffic through the Worker for 5 minutes, and agents on `/mcp` count as activity | 5 minutes is the user's. Counting agents is the recommended default, applied without the user's confirmation |
| Worker and pod secrets are set by the user in GitHub and Runpod, never in chat                 | Hard rule 11                                                                                                 |

## 7. Changed / rejected

- Deploy target: Cloudflare (`pnpm deploy:selfhost`) → Runpod pod (user: "Deploy it in run pod. I do have credit with them. And I don't use it. So deploy it there."). Interpreted "it" as Cloudflare; see section 12.
- Docker standalone fixes: deferred → done at the user's request.
- Local rehearsal before the pod deploy: rejected by the user.
- Not changed, not a real gap: legacy Docker scheduler skipping the daily job (that edition always runs without sign-in, where the job is unused).
- Not built, feature rather than bug: scheduled Local SEO checks in any edition.
- Not done: editing `.agents/skills/**` and `plugins/openseo/skills/**` links (review control plane, shipped skill content).
- Not done: retargeting the upstream-gated workflows `deploy-production.yml`, `deploy-website.yml`, `pr-preview.yml`, `docker-image.yml` (inert on the fork).
- Front door for wake on access: Vercel function → Cloudflare Worker (Vercel cannot proxy WebSockets; the user chose Cloudflare).
- In-pod idle watcher using `runpodctl` → idle check in the Worker (no key inside the pod, and it sees all traffic including `/mcp`).

## 8. Data & facts (exact)

**Repository**

| Item                         | Value                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fork                         | `osamagweaa/open-seo`, MIT, app version 0.1.21                                                                                                       |
| Upstream                     | `every-app/open-seo`                                                                                                                                 |
| Working branch               | `claude/modest-maxwell-ry8qh2`                                                                                                                       |
| Pull request                 | https://github.com/osamagweaa/open-seo/pull/1 (draft, base `main`)                                                                                   |
| Branch commits, oldest first | 43f5169 e2e helper, a6b244e links, 8e778cb telemetry, 7e76c0f scripts and docs, b1a505f verification checklist, 2227c5c Docker fixes, ce03f90 Runpod |
| CI on ce03f90                | `ci`, `docker-build`, `standalone-image`, `everyapp release` passed; `preview` skipped by design                                                     |
| Local checks at 2227c5c      | 266 test files, 1,827 tests passed; `ci:check` passed                                                                                                |

**Runpod deployment**

| Item            | Value                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pod id          | `jl8n558l4bwyu3`, name `openseo`, status RUNNING when last read                                                                                                                      |
| Hardware        | `cpu3g`, 2 vCPU, 8 GB memory, container disk 20 GB, data center EU-RO-1, cloud SECURE                                                                                                |
| Image           | `node:22`                                                                                                                                                                            |
| Public URL      | https://jl8n558l4bwyu3-3001.proxy.runpod.net                                                                                                                                         |
| Exposed port    | `3001/http`                                                                                                                                                                          |
| Network volume  | id `iu0ap07mv7`, name `openseo-data`, 10 GB, STANDARD, EU-RO-1, mounted at `/workspace`                                                                                              |
| Pod cost        | $0.08 per hour (2 vCPU x $0.04, catalog read; pod read confirmed 0.08)                                                                                                               |
| Volume cost     | about $0.70 per month ($0.07 per GB per month, Runpod storage docs)                                                                                                                  |
| Start command   | `/bin/bash -c "rm -rf /app && git clone --depth 1 --branch claude/modest-maxwell-ry8qh2 https://github.com/osamagweaa/open-seo /app && cd /app && exec bash deploy/runpod/start.sh"` |
| State directory | `/workspace/openseo` holds `better-auth-secret`, `operator-secret` and the database under `wrangler/`                                                                                |
| Build time      | Created 22:18:54, health returned 200 at 22:22:13 on 2026-10-30                                                                                                                      |

**Runpod behavior**

- Container disk is wiped on stop and restart. Volume data survives stop, restart and terminate.
- Editing a pod's environment resets the pod. The app then rebuilds in about 4 minutes.
- HTTP proxy requests time out at 100 seconds. The proxy URL is public and unauthenticated; only the app's own accounts protect it.
- A stopped pod bills no compute. The volume keeps billing.
- A pod can stop itself: Runpod docs say to run `runpodctl pod stop $RUNPOD_POD_ID` from inside it, and that pods ship `runpodctl` and a pod-scoped API key. The stock `node:22` image used here is not an official Runpod image, so whether `RUNPOD_API_KEY` and `runpodctl` exist in it is unverified. Fallback: call the REST API with a key.
- A stopped pod stays tied to its machine and resumes there. For GPU pods the REST start fails if another user took the GPU. Whether a stopped CPU pod can fail to restart is not documented in what was read. Fallback: terminate and recreate the pod with the same network volume; the pod id and proxy URL then change.
- The app has no session settings in `src/lib/auth-config.ts`, so sign-in sessions use Better Auth defaults (believed to be 7 days, refreshed daily; from library knowledge, verify before relying on it).

**Capabilities, from the code (2026-11-01; nothing seen returning real data, no DataForSEO key set)**

| Area                                         | Status                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyword research                             | Ideas, suggestions, volume and metrics, competitor domain keywords. Each keyword has a 12-month volume history (the trend signal). Keyword-clustering skill shipped.          |
| Optimization                                 | MCP tool `get_search_opportunities` joins Search Console pages at positions 4 to 20 with GA4 landing-page results and scores them. No on-page content editor.                 |
| Tracking                                     | Rank tracking, SERP results, site audit, AI-search visibility.                                                                                                                |
| Search Console                               | Connected: clicks, impressions, positions, URL inspection. Needs the user's own Google OAuth app; setup in `docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`. Needs no DataForSEO. |
| Google Analytics 4                           | Connected, including e-commerce: item views, add-to-cart, purchases and revenue by item and landing page.                                                                     |
| Google Business Profile and Maps             | Local rankings, reviews, updates, questions.                                                                                                                                  |
| Google Trends                                | Not supported. No code. Google Trends has no official API.                                                                                                                    |
| Merchant Center, Google Shopping, Google Ads | Not supported. Volumes come through DataForSEO.                                                                                                                               |
| Shopify                                      | Only crawler access for the site audit. No store data integration.                                                                                                            |

**Pod lifecycle measurements (Runpod, 2026-11-01)**

- Before it was stopped, the pod ran idle about 34.5 hours (uptime 124,129 s since the 2026-10-31 01:25:39 restart). Estimated cost since creation about $3 (0.08 x about 37.6 h).
- Stop through the API: status EXITED. Start through the API from EXITED: status RUNNING, new `startedAt` 2026-11-01T11:58:55. A stopped CPU pod does start, so the Worker's wake path is valid.
- After that start, Runpod's own work took about 3.5 minutes before the first app log line (container created 11:59:41, first app log 12:02:23). The database survived on the volume: "No migrations to apply!".
- That start rebuilt the app because the saved build is keyed by the commit id and the branch tip had moved to `88455df` (a documentation-only commit). The client build alone took 12:05:09 to 12:08:43. Any commit to the cloned branch invalidates the saved build.
- The earlier 111 s figure was for an in-place `restart`, not stop then start. Wake time for stop then start is not measured with a warm build; expect about 3.5 minutes of Runpod resume plus app boot.
- A first poll reported health 200 seven seconds after start. That was a stale answer from the old container, not a real result. Poll for a non-200 first, then two consecutive 200s.

**DataForSEO**

- Pay as you go. $1 signup credit and a $50 minimum top-up, from the DataForSEO pricing page and `docs/DATAFORSEO_API_KEY.md`.
- Env var `DATAFORSEO_API_KEY` is the base64 of `login:password` (the "Base64" credentials from https://app.dataforseo.com/api-access), not the dashboard API key.
- Spec 0004 measures the default 150-row keyword research call at $0.042 raw (two Labs tasks). About 23 such calls per $1 and about 1,190 per $50.
- The app reports the key as a warning until it is set. The app has no other SEO data provider.

## 9. People, terms & names

- **People:** Osama, the user and repo owner.
- **Terms & nicknames:** "RAM pod" and "run pod" mean Runpod. "Data forced API" means the DataForSEO API key. "Milestone" means this handoff.
- **Names in use:**
  - `deploy/runpod/start.sh`, `docs/SELF_HOSTING_RUNPOD.md`
  - `src/shared/links.ts`, `src/standalone-config.test.ts`
  - `docs/maintainers/fork-selfhost-verification.md`, `docs/maintainers/handoff-open-seo-fork.md`
  - Env vars: `AUTH_MODE=password`, `BETTER_AUTH_URL`, `OPENSEO_TELEMETRY_POSTHOG_KEY`, `GOOGLE_MAPS_API_KEY`, `CRAWLER_ACCESS_SECRET`

## 10. Work state

| Item                                  | Status                                                              | Location                                                                                                                 | Notes                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Draft PR #1                           | Open, CI green at ce03f90                                           | https://github.com/osamagweaa/open-seo/pull/1                                                                            | Waiting on the user's review; session was subscribed to its events                                                         |
| Telemetry opt-in                      | Done                                                                | `src/server/lib/self-host-telemetry.ts`, `scripts/selfhost-preflight.ts`, `deploy/alchemy/alchemy.run.ts`                | Test added                                                                                                                 |
| Link module and help links            | Done                                                                | `src/shared/links.ts`                                                                                                    | Hosted-only screens untouched                                                                                              |
| E2E helper fix                        | Done                                                                | `tests/domain-overview-test-utils.ts`                                                                                    | Stale "Refine table results" heading; perf spec needs `DOMAIN_FILTER_CPU_THROTTLE=2` on slow machines                      |
| Docker standalone fixes               | Done in code and CI image build                                     | `src/standalone-server.ts`, `wrangler.standalone.json`, `scripts/celld/runtime/configure.mjs`, `deploy/standalone/`      | Never run in a real Docker daemon                                                                                          |
| Scripts, CODEOWNERS, README, docs     | Done                                                                | repo root, `docs/`                                                                                                       | Needs maintainer review per `AGENTS.md`                                                                                    |
| Manual workflow `deploy-selfhost.yml` | Added, untested                                                     | `.github/workflows/`                                                                                                     | Cloudflare only; no longer the chosen target                                                                               |
| Runpod pod and volume                 | Pod stopped by Claude on 2026-11-01 (see the last line of this row) | See section 8                                                                                                            | Stop and start tested. Final state recorded in section 12.                                                                 |
| Admin account                         | Created by the user                                                 | Pod                                                                                                                      | Registration is now closed                                                                                                 |
| DataForSEO key                        | Not set                                                             | Pod env                                                                                                                  | Blocks all SEO data features                                                                                               |
| SEO data features with real data      | Not verified                                                        | Pod                                                                                                                      | No key available in the chat                                                                                               |
| MCP on the pod                        | Not verified on the pod                                             | Pod                                                                                                                      | Verified earlier on a local dev server in password mode                                                                    |
| Gate Worker                           | Built and unit tested (9 tests), not deployed                       | `scripts/runpod-gate/index.ts`, `wrangler.jsonc`, `gate.test.ts`                                                         | Needs the user's Cloudflare and Runpod credentials                                                                         |
| Gate storage (Cloudflare KV)          | Created by Claude through the Cloudflare connector on 2026-11-01    | KV namespace `openseo-gate-state`, id `9a2d9ba0f62640c3aa406781ea6986d3`, pinned in `scripts/runpod-gate/wrangler.jsonc` | The connector cannot deploy Workers or set secrets; deploy runs from the GitHub workflow                                   |
| Gate deploy workflow                  | Added, not run                                                      | `.github/workflows/deploy-runpod-gate.yml`                                                                               | Runs only from `main`, so PR #1 must merge first                                                                           |
| Idle logout option                    | Done, tested                                                        | `src/lib/auth-session-idle.ts`, `src/lib/auth.ts`                                                                        | Set `OPENSEO_SESSION_IDLE_MINUTES=5` on the pod; not yet set                                                               |
| Build cache on the volume             | Done; works only while the cloned commit is unchanged               | `deploy/runpod/start.sh`                                                                                                 | Keyed by commit id, so any new commit rebuilds. Consider pinning the pod to a fixed ref or keying by build-relevant files. |

## 11. Next steps

1. **Next action (secrets verified 2026-11-01):** The three GitHub secrets were tested before merging with a one-off workflow, since deleted: the Cloudflare token, account ID, Workers Scripts, Workers KV and Account Settings checks all passed, and the Runpod key read the pod and passed a control probe (HTTP 409 on a stop of the stopped pod). The first Runpod key failed with 401 on every endpoint and was replaced. Now deploy the gate Worker. The user adds three GitHub secrets, `RUNPOD_API_KEY` (created in the Runpod console), `CLOUDFLARE_API_TOKEN` (permissions: Workers Scripts edit, Workers KV Storage edit) and `CLOUDFLARE_ACCOUNT_ID`, then merges PR #1 and runs the **Deploy Runpod Gate** workflow from `main`. Alternative from the user's computer: `pnpm exec wrangler deploy -c scripts/runpod-gate/wrangler.jsonc`, then `pnpm exec wrangler secret put RUNPOD_API_KEY -c scripts/runpod-gate/wrangler.jsonc`.
2. After the Worker address is known, edit the pod's environment: `BETTER_AUTH_URL` = the Worker address and `OPENSEO_SESSION_IDLE_MINUTES` = `5`. Saving resets the pod.
3. Verify end to end with evidence: stop the pod, open the Worker address, confirm the waiting page then the app; leave it idle over 5 minutes and read the pod's status with `get-pod` to confirm `EXITED`. Also confirm sign-in works on the Worker address and that live chat (WebSocket) works through it.
4. The user signs up at DataForSEO, copies the Base64 credentials, and adds `DATAFORSEO_API_KEY` under Edit Pod. Run one keyword search to confirm data returns. Test with the $1 trial credit before any $50 top-up.
5. After PR #1 merges, change the pod's clone branch from `claude/modest-maxwell-ry8qh2` to `main`.
6. Optional: Google Search Console and GA4 with the user's own Google OAuth app (free, no DataForSEO needed); `OPENROUTER_API_KEY` for the SAM agent; scheduled Local SEO checks.
7. Feature options the user can choose from: Google Merchant Center and Shopping data (recommended first for e-commerce; official API), Google Trends (no official API; unofficial route or a paid provider), Shopify store data. Plan with the user before building.
8. Improve wake time: pin the pod to a fixed ref or key the saved build by build-relevant files, and update the waiting page text, which says one to four minutes.

**As built (commit a163afa):**

- **Worker** (`scripts/runpod-gate`): checks the pod through the Runpod API at `https://api.runpod.io/v2`, starts it if `EXITED`, shows a refreshing waiting page, then reverse-proxies including WebSockets. Records activity in KV at most every 30 seconds. A once-a-minute cron stops a `RUNNING` pod after `IDLE_MINUTES` (default 5) with no traffic. `POD_ID` is set in `wrangler.jsonc`.
- **Pod** (`deploy/runpod/start.sh`): allows the pod's own proxy host (`ALLOWED_HOST`) so requests arriving through the Worker are accepted, and keeps the build on the volume keyed by commit.
- **App**: `OPENSEO_SESSION_IDLE_MINUTES` sets a sliding session so idleness logs the user out.
- **Trade-offs told to the user:** scheduled rank tracking and AI visibility checks run only while the pod is up; stopping ends running work, such as an audit; the Worker address is public and can start the pod; use the Worker address only, since a pod with no traffic through the Worker is stopped even if used directly. Example cost at one hour of use per day: $2.40 per month plus about $0.70 for the volume.
- **Not yet tested live:** the Worker against the real Runpod and Cloudflare APIs, starting an `EXITED` CPU pod through the API (a stopped pod stays tied to its machine; if start fails, fall back to terminating and recreating the pod with the same volume and updating `POD_ID`), WebSocket proxying, and the idle stop.

## 12. Open questions

- "I don't use it": confirm this meant Cloudflare. All deploy work after it assumed so.
- Does the $1 DataForSEO trial credit work over the REST API? The pricing page mentions the Playground, MCP and integrations. Unverified.
- Which app features work with no DataForSEO key? From the code inventory, the site audit crawler, Search Console views, reports and project context do not need it, and Lighthouse does. Not verified on the pod.
- **Final pod state: stopped (status EXITED), as read after the stop call on 2026-11-01.** Claude stopped `jl8n558l4bwyu3` after about 34.5 idle hours, started it once to test (it ran 724 s and was still building the app when stopped, so app readiness after a stop then start was not confirmed to completion), then stopped it again to avoid idle billing. The volume `iu0ap07mv7` is intact. The wake path needs the Worker deployed; until then, start the pod with `pod-action` start or from the Runpod console, wait for `/api/health` to return 200 (poll for a non-200 first, then two 200s), and stop it when done.
- Does an agent using `/mcp` with an API key count as activity? Applied as yes (recommended); the user has not confirmed.
- Is it acceptable that scheduled rank tracking and AI visibility checks pause while the pod is stopped?

## 13. Re-attach checklist

- [ ] Nothing to attach. Everything is pushed to `claude/modest-maxwell-ry8qh2`. The new session needs GitHub access to `osamagweaa/open-seo` and the Runpod MCP connection.
- The session scratch log `/tmp/claude-0/-home-user-open-seo/177df9e0-88a1-52cb-a274-a71228dcfcbc/scratchpad/deploy-log.md` is container-local and may be gone. This file replaces it.

---

<sub>Audit: 13/13 sections · 11 rules · 2 corrections · 60 data points · secrets removed: none found · generated by active-memory</sub>
