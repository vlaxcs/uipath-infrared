import { afterEach, describe, expect, it, vi } from "vitest";
import { OrchestratorError, orchestratorOnboarding } from "~/onboarding/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function answering(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("the onboarding data source", () => {
  it("reads the setup from the orchestrator", async () => {
    vi.stubEnv("VITE_ORCHESTRATOR_URL", "http://orchestrator.test/");
    const fetch = answering(200, { connections: [], providers: ["aws"], onprem: false, projects: [] });
    await expect(orchestratorOnboarding.load()).resolves.toMatchObject({ providers: ["aws"] });
    expect(fetch).toHaveBeenCalledWith("http://orchestrator.test/onboarding", undefined);
  });

  it("posts the answers to start a run", async () => {
    vi.stubEnv("VITE_ORCHESTRATOR_URL", "http://orchestrator.test");
    const fetch = answering(201, { id: "run-startup-0001", project: "startup" });
    const request = { project: "startup", onboarding: { connection: "floci", targets: ["aws"], onprem: { wanted: false } } };
    await expect(orchestratorOnboarding.start(request)).resolves.toMatchObject({ id: "run-startup-0001" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://orchestrator.test/runs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("passes the orchestrator's reason through", async () => {
    vi.stubEnv("VITE_ORCHESTRATOR_URL", "http://orchestrator.test");
    answering(409, { error: "project busy: startup is run-startup-0002" });
    await expect(orchestratorOnboarding.load()).rejects.toThrow("project busy: startup is run-startup-0002");
  });

  it("says the platform is unreachable when the request never lands", async () => {
    vi.stubEnv("VITE_ORCHESTRATOR_URL", "http://orchestrator.test");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(orchestratorOnboarding.load()).rejects.toThrow(/unreachable/);
  });

  it("names the variable when the orchestrator URL is missing", async () => {
    vi.stubEnv("VITE_ORCHESTRATOR_URL", "");
    const failure = orchestratorOnboarding.load();
    await expect(failure).rejects.toBeInstanceOf(OrchestratorError);
    await expect(failure).rejects.toThrow("VITE_ORCHESTRATOR_URL");
  });
});
