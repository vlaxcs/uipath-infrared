import { afterEach, describe, expect, it, vi } from "vitest";
import { onSignedOut } from "~/account/session";
import { createHttpRunSource } from "~/runs/httpRunSource";

describe("the run source against an orchestrator with sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the session cookie on reads and writes", async () => {
    const fetcher = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const source = createHttpRunSource("http://127.0.0.1:8080");
    await source.listRuns();
    await source.readArtifact("run-1", "infra.json");
    for (const call of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[1].credentials).toBe("include");
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reports a signed-out session when the orchestrator answers 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "sign in first" }), { status: 401 })));
    const signedOut = vi.fn();
    const stop = onSignedOut(signedOut);
    await expect(createHttpRunSource("http://127.0.0.1:8080").listRuns()).rejects.toThrow("sign in first");
    expect(signedOut).toHaveBeenCalledTimes(1);
    stop();
  });
});
