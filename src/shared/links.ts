// Where this deployment's docs, source and issue tracker live. Every in-app
// link to project resources goes through here so a fork changes one file.
export const REPO_SLUG = "osamagweaa/open-seo";
const REPO_URL = `https://github.com/${REPO_SLUG}`;

export const ISSUES_URL = `${REPO_URL}/issues`;
export const MCP_SERVER_ICON_URL = `https://raw.githubusercontent.com/${REPO_SLUG}/main/src/public/android-chrome-512x512.png`;
export const PROJECT_WEBSITE_URL = REPO_URL;

/** GitHub URL for a file in the repository, e.g. `docs/SELF_HOSTING_DOCKER.md#anchor`. */
export function repoFileUrl(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}
