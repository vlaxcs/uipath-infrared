import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function componentsUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentsUnder(path);
    if (entry.name.includes(".test.") || !entry.name.endsWith(".tsx")) return [];
    return [path];
  });
}

function openingTags(source: string, tag: string): { line: number; text: string }[] {
  const tags: { line: number; text: string }[] = [];
  let start = source.indexOf(`<${tag}`);
  while (start !== -1) {
    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    tags.push({ line: source.slice(0, start).split("\n").length, text: source.slice(start, end + 1) });
    start = source.indexOf(`<${tag}`, end);
  }
  return tags.filter(({ text }) => new RegExp(`^<${tag}[\s>]`).test(text));
}

describe("the buttons", () => {
  it("give feedback on hover unless they are permanently disabled", () => {
    const silent = componentsUnder(SRC).flatMap((file) =>
      openingTags(readFileSync(file, "utf8"), "button")
        .filter(({ text }) => !/\sdisabled(?=[\s>])/.test(text))
        .filter(({ text }) => !/\bhover:/.test(text))
        .map(({ line }) => `${relative(SRC, file)}:${line}`),
    );

    expect(silent).toEqual([]);
  });
});
