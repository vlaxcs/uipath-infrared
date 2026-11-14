import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  getSettings,
  hasOrchestratorPermission,
  isLocalOrchestratorUrl,
  isRemoteOrchestratorUrl,
  isSupportedOrchestratorUrl,
  normalizeSettings,
  orchestratorOriginPattern,
  saveSettings,
} from "~/storage";

let store: Map<string, unknown>;
let contains: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = new Map();
  contains = vi.fn(async () => true);
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
    permissions: { contains },
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

  it("accepts hosted orchestrators only over HTTPS", () => {
    expect(isRemoteOrchestratorUrl("https://infrared.example.com")).toBe(true);
    expect(isRemoteOrchestratorUrl("http://infrared.example.com")).toBe(false);
    expect(isRemoteOrchestratorUrl("http://127.0.0.1:8080")).toBe(false);
    expect(isSupportedOrchestratorUrl("https://infrared.example.com/app")).toBe(true);
    expect(isSupportedOrchestratorUrl("http://127.0.0.1:8080")).toBe(true);
    expect(isSupportedOrchestratorUrl("http://infrared.example.com")).toBe(false);
  });

  it("builds an origin pattern without the port", () => {
    expect(orchestratorOriginPattern("https://infrared.example.com/app")).toBe(
      "https://infrared.example.com/*",
    );
    expect(orchestratorOriginPattern("http://127.0.0.1:8080/")).toBe("http://127.0.0.1/*");
    expect(orchestratorOriginPattern("nope")).toBeNull();
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
    expect(
      normalizeSettings({
        orchestratorUrl: "https://infrared.example.com/",
        dashboardUrl: DEFAULT_SETTINGS.dashboardUrl,
      }).orchestratorUrl,
    ).toBe("https://infrared.example.com");
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

  it("saves a hosted HTTPS orchestrator", async () => {
    const saved = await saveSettings({
      orchestratorUrl: "https://infrared.example.com/",
      dashboardUrl: "https://dashboard.example.com/",
    });

    expect(saved).toEqual({
      orchestratorUrl: "https://infrared.example.com",
      dashboardUrl: "https://dashboard.example.com",
    });
    expect(store.get("orchestratorUrl")).toBe("https://infrared.example.com");
  });

  it("rejects an insecure remote orchestrator", async () => {
    await expect(
      saveSettings({ orchestratorUrl: "http://example.com", dashboardUrl: "http://localhost:5173" }),
    ).rejects.toThrow(/https/);
    expect(store.size).toBe(0);
  });

  it("grants local access without a permission check", async () => {
    await expect(hasOrchestratorPermission("http://127.0.0.1:8080")).resolves.toBe(true);
    expect(contains).not.toHaveBeenCalled();
  });

  it("checks the host permission for a hosted orchestrator", async () => {
    await expect(hasOrchestratorPermission("https://infrared.example.com/app")).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ["https://infrared.example.com/*"] });

    contains.mockResolvedValueOnce(false);
    await expect(hasOrchestratorPermission("https://other.example.com")).resolves.toBe(false);
  });
});
