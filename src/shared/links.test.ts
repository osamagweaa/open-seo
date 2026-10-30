import { describe, expect, it } from "vitest";
import { ISSUES_URL, repoFileUrl } from "./links";

describe("links", () => {
  it("points docs and issues at the fork repository", () => {
    expect(repoFileUrl("docs/SELF_HOSTING_CLOUDFLARE.md#anchor")).toBe(
      "https://github.com/osamagweaa/open-seo/blob/main/docs/SELF_HOSTING_CLOUDFLARE.md#anchor",
    );
    expect(ISSUES_URL).toBe("https://github.com/osamagweaa/open-seo/issues");
  });
});
