import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isLocalOrchestratorUrl,
  normalizeSettings,
  saveSettings,
} from "~/storage";

let store: Map<string, unknown>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (keys: string[]) =>
          Object.fromEntries(keys.map((key) => [key, store.get(key)])),
        set: async (values: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(values)) store.set(key, value);
        },
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extension settings", () => {
  it("accepts localhost orchestrators and http(s) dashboards", () => {
    expect(isLocalOrchestratorUrl("http://127.0.0.1:8080")).toBe(true);
    expect(isLocalOrchestratorUrl("http://localhost:8080/")).toBe(true);
    expect(isLocalOrchestratorUrl("https://localhost:8080")).toBe(false);
    expect(isLocalOrchestratorUrl("http://example.com")).toBe(false);
  });

  it("falls back to the defaults for invalid stored values", () => {
    expect(
      normalizeSettings({ orchestratorUrl: "http://example.com", dashboardUrl: "not a url" }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        orchestratorUrl: " http://localhost:8080/ ",
        dashboardUrl: "https://example.com/dashboard/",
      }),
    ).toEqual({
      orchestratorUrl: "http://localhost:8080",
      dashboardUrl: "https://example.com/dashboard",
    });
  });

  it("reads defaults from an empty store", async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("saves normalized settings and reads them back", async () => {
    await saveSettings({
      orchestratorUrl: "http://127.0.0.1:8080/",
      dashboardUrl: "http://localhost:5173/",
    });

    await expect(getSettings()).resolves.toEqual({
      orchestratorUrl: "http://127.0.0.1:8080",
      dashboardUrl: "http://localhost:5173",
    });
  });

  it("rejects a non-local orchestrator", async () => {
    await expect(
      saveSettings({ orchestratorUrl: "http://example.com", dashboardUrl: "http://localhost:5173" }),
    ).rejects.toThrow(/localhost/);
    expect(store.size).toBe(0);
  });
});
