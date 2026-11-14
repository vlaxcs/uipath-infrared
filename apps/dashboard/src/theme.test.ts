import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

async function generates(candidate: string): Promise<boolean> {
  const compiler = await compile(readFileSync(join(SRC, "index.css"), "utf8"), {
    base: SRC,
    onDependency: () => {},
  });
  return compiler.build([candidate]).includes(`.${candidate} {`);
}

describe("the Tailwind theme", () => {
  it.each([
    "bg-surface",
    "text-fg-muted",
    "border-status-failed",
    "text-label",
    "rounded-card",
    "font-mono",
    "fill-graph-stack-1",
    "stroke-graph-edge",
    "border-status-idle",
    "text-status-orphan",
    "bg-accent-hover",
    "bg-credit-hover",
  ])("generates the token utility %s", async (candidate) => {
      expect(await generates(candidate)).toBe(true);
    },
  );

  it.each(["bg-blue-500", "text-white", "text-sm", "text-2xl", "rounded-lg", "font-serif"])(
    "does not generate the default utility %s",
    async (candidate) => {
      expect(await generates(candidate)).toBe(false);
    },
  );
});
