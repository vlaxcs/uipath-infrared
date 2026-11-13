import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

const RULES = [
  { name: "hex colour", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "colour function", pattern: /\b(?:rgb|hsl|oklch|color-mix)\(/ },
  { name: "pixel value", pattern: /\b\d+(?:\.\d+)?px\b/ },
  { name: "arbitrary pixel utility", pattern: /\[[^\]]*px[^\]]*\]/ },
  { name: "inline style", pattern: /style=\{/ },
];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    if (entry.name.includes(".test.")) return [];
    if (!/\.(?:ts|tsx|css)$/.test(entry.name)) return [];
    if (path.endsWith(join("styles", "tokens.css"))) return [];
    return [path];
  });
}

describe("the design tokens", () => {
  it("keeps colour and size values out of components and the global styles", () => {
    const violations = filesUnder(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          RULES.filter((rule) => rule.pattern.test(line)).map(
            (rule) => `${relative(SRC, file)}:${index + 1}: ${rule.name}: ${line.trim()}`,
          ),
        ),
    );

    expect(violations).toEqual([]);
  });
});
