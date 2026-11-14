import { join } from "node:path";
import { resolveConfig } from "vite";
import { describe, expect, it } from "vitest";

describe("the platform route", () => {
  it("builds the dashboard to be served under /app/", async () => {
    const configFile = join(import.meta.dirname, "..", "..", "vite.config.ts");
    const config = await resolveConfig({ configFile }, "build");
    expect(config.base).toBe("/app/");
  });
});
