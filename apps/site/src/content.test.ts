import { describe, expect, it } from "vitest";
import { content } from "./content.ts";

function leaves(value: unknown, path: string): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return [[`${path}.length`, value.length], ...value.flatMap((item, index) => leaves(item, `${path}[${index}]`))];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

describe("content", () => {
  const ro = leaves(content.ro, "");
  const en = leaves(content.en, "");

  it("has the same keys and list lengths in Romanian and English", () => {
    const shape = (entries: Array<[string, unknown]>) =>
      entries.map(([path, value]) => (path.endsWith(".length") ? `${path}=${value}` : path));
    expect(shape(en)).toEqual(shape(ro));
  });

  it("has no empty string in either language", () => {
    for (const [path, value] of [...ro, ...en]) {
      if (typeof value === "string") {
        expect(value.trim(), path).not.toBe("");
      }
    }
  });
});
