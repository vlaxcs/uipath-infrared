import { describe, expect, it } from "vitest";
import { readSettings } from "~/runs/settings";

describe("dashboard settings", () => {
  it("reads and trims the orchestrator URL", () => {
    expect(readSettings({ VITE_ORCHESTRATOR_URL: "  http://127.0.0.1:8080/  " })).toEqual({
      orchestratorUrl: "http://127.0.0.1:8080",
    });
  });

  it("treats a missing or empty URL as sample mode", () => {
    expect(readSettings({})).toEqual({ orchestratorUrl: null });
    expect(readSettings({ VITE_ORCHESTRATOR_URL: "   " })).toEqual({ orchestratorUrl: null });
  });
});
