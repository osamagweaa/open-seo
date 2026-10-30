# active-memory handoff: open-seo fork (self-host on Runpod)

**Handoff #1** · 2026-10-30 · Lineage: #1 (2026-10-30): decoupled the fork from upstream, fixed Docker standalone gaps, opened PR #1, deployed to a Runpod pod, user created the admin account, blocked on the DataForSEO key.

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

| Decision                                                                            | Why                                                                                                       |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Target is a self-hosted instance, not a hosted SaaS                                 | User's choice at planning                                                                                 |
| Branding: decouple only, keep the OpenSEO name                                      | User's choice at planning                                                                                 |
| Deploy on a Runpod CPU pod, not Cloudflare                                          | User has Runpod credit and does not use Cloudflare                                                        |
| Single pod runs the repo's existing single-container flow in `AUTH_MODE=password`   | The multi-container Docker edition does not fit one pod; password mode gives real sign-in on a public URL |
| State lives on a network volume at `/workspace`                                     | CPU pods cannot use a local persistent disk; container disk is wiped on stop or restart                   |
| Secrets are generated on first start and kept on the volume                         | Keeps them out of pod config and chat                                                                     |
| Telemetry is opt-in via `OPENSEO_TELEMETRY_POSTHOG_KEY`                             | Upstream's PostHog key was removed from the source                                                        |
| Docker standalone gaps are fixed in code                                            | User asked: "fix the docker standalone gaps too"                                                          |
| `GOOGLE_MAPS_API_KEY` and `CRAWLER_ACCESS_SECRET` are passed through the Docker env | Matches how other optional credentials work                                                               |
| Skill files, the SAM fact sheet and hosted-only screens are left unchanged          | Review control plane and hosted-only code                                                                 |

## 7. Changed / rejected

- Deploy target: Cloudflare (`pnpm deploy:selfhost`) → Runpod pod (user: "Deploy it in run pod. I do have credit with them. And I don't use it. So deploy it there."). Interpreted "it" as Cloudflare; see section 12.
- Docker standalone fixes: deferred → done at the user's request.
- Local rehearsal before the pod deploy: rejected by the user.
- Not changed, not a real gap: legacy Docker scheduler skipping the daily job (that edition always runs without sign-in, where the job is unused).
- Not built, feature rather than bug: scheduled Local SEO checks in any edition.
- Not done: editing `.agents/skills/**` and `plugins/openseo/skills/**` links (review control plane, shipped skill content).
- Not done: retargeting the upstream-gated workflows `deploy-production.yml`, `deploy-website.yml`, `pr-preview.yml`, `docker-image.yml` (inert on the fork).

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

| Item                                  | Status                          | Location                                                                                                            | Notes                                                                                                 |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Draft PR #1                           | Open, CI green at ce03f90       | https://github.com/osamagweaa/open-seo/pull/1                                                                       | Waiting on the user's review; session was subscribed to its events                                    |
| Telemetry opt-in                      | Done                            | `src/server/lib/self-host-telemetry.ts`, `scripts/selfhost-preflight.ts`, `deploy/alchemy/alchemy.run.ts`           | Test added                                                                                            |
| Link module and help links            | Done                            | `src/shared/links.ts`                                                                                               | Hosted-only screens untouched                                                                         |
| E2E helper fix                        | Done                            | `tests/domain-overview-test-utils.ts`                                                                               | Stale "Refine table results" heading; perf spec needs `DOMAIN_FILTER_CPU_THROTTLE=2` on slow machines |
| Docker standalone fixes               | Done in code and CI image build | `src/standalone-server.ts`, `wrangler.standalone.json`, `scripts/celld/runtime/configure.mjs`, `deploy/standalone/` | Never run in a real Docker daemon                                                                     |
| Scripts, CODEOWNERS, README, docs     | Done                            | repo root, `docs/`                                                                                                  | Needs maintainer review per `AGENTS.md`                                                               |
| Manual workflow `deploy-selfhost.yml` | Added, untested                 | `.github/workflows/`                                                                                                | Cloudflare only; no longer the chosen target                                                          |
| Runpod pod and volume                 | Live and verified               | See section 8                                                                                                       | `/api/health` 200 in password mode, database ok, DataForSEO warning, pages load                       |
| Admin account                         | Created by the user             | Pod                                                                                                                 | Registration is now closed                                                                            |
| DataForSEO key                        | Not set                         | Pod env                                                                                                             | Blocks all SEO data features                                                                          |
| SEO data features with real data      | Not verified                    | Pod                                                                                                                 | No key available in the chat                                                                          |
| MCP on the pod                        | Not verified on the pod         | Pod                                                                                                                 | Verified earlier on a local dev server in password mode                                               |

## 11. Next steps

1. **Next action:** Get the user's approval on the auto-stop and wake-on-access design below, then build it in small pull requests. Nothing is built yet.
2. The user signs up at DataForSEO, copies the Base64 credentials, and adds `DATAFORSEO_API_KEY` in the Runpod console under Edit Pod. Then run one keyword search to confirm data returns. Test with the $1 trial credit before any $50 top-up.
3. If pausing: stop the pod with the Runpod `pod-action` stop on `jl8n558l4bwyu3`. Compute billing stops; the volume keeps its data.
4. When the user decides, merge PR #1, then change the pod's clone branch to `main` and update `docs/SELF_HOSTING_RUNPOD.md` if needed.
5. Optional: connect Google Search Console with the user's own Google OAuth app; add `OPENROUTER_API_KEY` for the SAM agent.
6. Optional: add scheduled Local SEO checks as a new feature.

**Design proposal for item 1 (not approved yet):**

- **Idle logout, in the app.** Add an env setting, for example `OPENSEO_SESSION_IDLE_MINUTES`, that sets Better Auth `session.expiresIn` to that many minutes with a short `updateAge`, so activity keeps the session alive and idle ends it. Default stays the current behavior. Change goes in `src/lib/auth-config.ts` with a test.
- **Idle stop, in the pod.** A watcher started by `deploy/runpod/start.sh` stops the pod after the idle period with no real activity. Count requests, not just browser sessions, so agents using an API key through `/mcp` are not cut off. Ignore `/api/health` and the loopback scheduler. Do not stop while a site audit or workflow is running. Stop through the Runpod API.
- **Wake on access.** A stopped pod has no public address, so something always on must receive the visit. Recommended: a free Cloudflare Worker, holding a Runpod API key as a secret. It checks the pod, starts it if stopped, shows a "starting" page that refreshes, then reverse-proxies to the pod, including WebSockets for SAM. Set `BETTER_AUTH_URL` to the Worker's address so sign-in stays on one stable address. Alternative: a Vercel function, which cannot proxy WebSockets.
- **Faster wake.** Today every start reclones, installs and builds, about 3.5 minutes (first deploy: created 22:18:54, health 200 at 22:22:13). Build once and keep the build on the network volume, or publish a prebuilt image from GitHub Actions, so a wake takes about a minute.
- **Trade-offs to state to the user.** Rank tracking and AI visibility checks only run while the pod is up, so they are skipped while stopped. Stopping kills anything still running. The wake address is public and can start the pod, which costs a few cents, and the app login still protects the data. Example cost at one hour of use per day: 0.08 x 30 = $2.40 per month plus about $0.70 for the volume.
- **Needs the user.** A free Cloudflare account (or Vercel), and a Runpod API key created in the Runpod console and stored as a Worker secret by the user, never pasted into chat.

## 12. Open questions

- "I don't use it": confirm this meant Cloudflare. All deploy work after it assumed so.
- Does the $1 DataForSEO trial credit work over the REST API? The pricing page mentions the Playground, MCP and integrations. Unverified.
- Which app features work with no DataForSEO key? From the code inventory, the site audit crawler, Search Console views, reports and project context do not need it, and Lighthouse does. Not verified on the pod.
- Should the pod keep running while the user decides on the key? It costs $0.08 per hour.
- Front door for wake-on-access: Cloudflare Worker (recommended) or Vercel? "I don't use it" may rule out Cloudflare; confirm.
- Idle rule: log out after 5 minutes idle and stop the pod at the same time, or give a longer grace period before stopping? Does an agent using `/mcp` with an API key count as activity? Recommended: yes.
- Is it acceptable that scheduled rank tracking and AI visibility checks pause while the pod is stopped?

## 13. Re-attach checklist

- [ ] Nothing to attach. Everything is pushed to `claude/modest-maxwell-ry8qh2`. The new session needs GitHub access to `osamagweaa/open-seo` and the Runpod MCP connection.
- The session scratch log `/tmp/claude-0/-home-user-open-seo/177df9e0-88a1-52cb-a274-a71228dcfcbc/scratchpad/deploy-log.md` is container-local and may be gone. This file replaces it.

---

<sub>Audit: 13/13 sections · 11 rules · 2 corrections · 60 data points · secrets removed: none found · generated by active-memory</sub>
