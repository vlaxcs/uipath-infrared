import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(
  join(import.meta.dirname, "../../dashboard/src/styles/tokens.css"),
  "utf8",
);
const panel = readFileSync(join(import.meta.dirname, "content/panel.css"), "utf8");

function value(css: string, name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
}

const PAIRS = [
  ["--color-canvas", "--ir-canvas"],
  ["--color-surface", "--ir-surface"],
  ["--color-surface-muted", "--ir-surface-muted"],
  ["--color-border", "--ir-border"],
  ["--color-border-strong", "--ir-border-strong"],
  ["--color-fg", "--ir-fg"],
  ["--color-fg-muted", "--ir-fg-muted"],
  ["--color-fg-subtle", "--ir-fg-subtle"],
  ["--color-accent", "--ir-accent"],
  ["--color-on-accent", "--ir-on-accent"],
  ["--color-status-running", "--ir-status-running"],
  ["--color-status-awaiting", "--ir-status-awaiting"],
  ["--color-status-completed", "--ir-status-completed"],
  ["--color-status-failed", "--ir-status-failed"],
  ["--color-status-neutral", "--ir-status-neutral"],
];

describe("the extension palette", () => {
  it("mirrors the dashboard's light tokens", () => {
    for (const [source, target] of PAIRS) {
      expect(value(panel, target), target).toBe(value(dashboard, source));
    }
  });
});
