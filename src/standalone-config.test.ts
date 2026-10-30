import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");
const matches = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match[1]).sort();

// The Docker edition runs every workflow in one celld module. A workflow
// the app binds but the standalone config lacks fails only at runtime.
describe("standalone Docker edition", () => {
  it("binds and exports every workflow the app binds", () => {
    const bindingPattern = /"binding":\s*"([A-Z_]+_WORKFLOW)"/g;
    const standalone = read("wrangler.standalone.json");

    expect(matches(standalone, bindingPattern)).toEqual(
      matches(read("wrangler.jsonc"), bindingPattern),
    );

    const entry = read("src/standalone-server.ts");
    for (const className of matches(
      standalone,
      /"class_name":\s*"(\w+Workflow)"/g,
    )) {
      expect(entry, className).toContain(className);
    }
  });
});
