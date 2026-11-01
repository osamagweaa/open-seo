# Verifying a Cloudflare self-host deploy

Run this after `pnpm deploy:selfhost --yes` (or the manual `Deploy Self-Host` workflow) to confirm the instance works end to end. It needs only a DataForSEO key; the optional keys unlock the items marked optional.

Replace `WORKER_URL` with the URL the deploy printed.

## Before the deploy

1. `pnpm alchemy login`, then `pnpm alchemy cloudflare bootstrap` (once per Cloudflare account).
2. `cp deploy/.env.selfhost.example .env.selfhost` and set `DATAFORSEO_API_KEY`.
3. `pnpm deploy:selfhost --yes`.

## Checks

| #   | Check                                                                                                                     | Pass when                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `curl --fail WORKER_URL/api/health`                                                                                       | `status` is `ok` and `authMode` is `password`                                 |
| 2   | Open `WORKER_URL`, create the administrator account                                                                       | Account is created and the app loads with a default project                   |
| 3   | Open `WORKER_URL` in a private window and try to create a second account                                                  | Registration is refused                                                       |
| 4   | Keyword research for any phrase                                                                                           | Volumes and ideas appear; saving a keyword works                              |
| 5   | Domain overview for your own domain                                                                                       | Traffic, keywords and competitors appear                                      |
| 6   | Backlinks for your own domain                                                                                             | Summary and referring domains appear                                          |
| 7   | Rank tracking: add a keyword and run a check                                                                              | A position appears; wait 5 minutes and confirm scheduled runs do not error    |
| 8   | Site audit on a small site                                                                                                | Crawl completes and the issues page lists results                             |
| 9   | AI visibility: add a prompt and run it                                                                                    | An answer is stored                                                           |
| 10  | Reports: create one and open its share link in a private window                                                           | The shared page renders without signing in                                    |
| 11  | Settings, API keys: create a key, then `claude mcp add --transport http openseo WORKER_URL/mcp --header "x-api-key: KEY"` | Your agent lists OpenSEO tools and `get_project_context` returns your project |
| 12  | Team settings: invite a second address and open the link in a private window                                              | The invited account joins your workspace                                      |
| 13  | Optional, with `OPENSEO_OPERATOR_SECRET` set: `OPENSEO_URL=WORKER_URL pnpm selfhost:admin reset-password`                 | The password changes                                                          |
| 14  | Optional, with `GOOGLE_MAPS_API_KEY` set: Local SEO                                                                       | Map tiles load and a grid check completes                                     |

Record any failing check with its exact error text in a GitHub issue.
