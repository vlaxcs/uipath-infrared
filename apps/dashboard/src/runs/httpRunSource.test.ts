import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpRunSource } from "~/runs/httpRunSource";
import { RunSourceError } from "~/runs/source";
import type { HumanDecision, RunDetail, RunEvent, RunSummary } from "~/runs/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

type FakeResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function response(status: number, body: unknown, text = JSON.stringify(body)): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  };
}

function stubFetch(...responses: FakeResponse[]) {
  const fetchMock = vi.fn().mockImplementation(async () => responses.shift() ?? response(200, {}));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const summary: RunSummary = {
  id: "run-1",
  project: "startup",
  status: "running",
  step: "extract",
  revision: 0,
  max_revisions: 2,
  started_at: "2026-11-14T09:00:00Z",
  updated_at: "2026-11-14T09:00:01Z",
};

const event: RunEvent = {
  seq: 1,
  at: "2026-11-14T09:00:00Z",
  step: "extract",
  status: "started",
  revision: 0,
  actor: { kind: "orchestrator" },
};

const decision: HumanDecision = {
  step: "present",
  status: "approved",
  actor: { kind: "human", id: "cto", surface: "dashboard" },
  decision: { kind: "pick_layout", reason: "EU", layout: "managed_services" },
};

describe("the HTTP run source", () => {
  it("lists runs without a trailing slash in the base URL", async () => {
    const fetchMock = stubFetch(response(200, [summary]));
    const source = createHttpRunSource("http://127.0.0.1:8080/");

    await expect(source.listRuns()).resolves.toEqual([summary]);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8080/runs", { signal: undefined, credentials: "include" });
    expect(source.mode).toBe("live");
  });

  it("reads a run with an encoded id", async () => {
    const fetchMock = stubFetch(response(200, {} as RunDetail));
    await createHttpRunSource("http://host").getRun("run/1");
    expect(fetchMock.mock.calls[0][0]).toBe("http://host/runs/run%2F1");
  });

  it("starts a run with a JSON body", async () => {
    const fetchMock = stubFetch(response(201, {} as RunDetail));
    await createHttpRunSource("http://host").startRun("startup");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://host/runs");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ project: "startup" }));
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("asks for events after a sequence number", async () => {
    const fetchMock = stubFetch(response(200, [event]));
    await expect(createHttpRunSource("http://host").eventsAfter("run-1", 7)).resolves.toEqual([event]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://host/runs/run-1/events?after=7");
  });

  it("submits a decision", async () => {
    const fetchMock = stubFetch(response(200, event));
    await expect(createHttpRunSource("http://host").submitDecision("run-1", decision)).resolves.toEqual(event);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://host/runs/run-1/decisions");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(decision));
  });

  it("lists and reads run files", async () => {
    const files = [{ path: "infra.json", size: 12 }];
    const fetchMock = stubFetch(response(200, files), response(200, null, '{"components":[]}'));

    await expect(createHttpRunSource("http://host").listFiles("run-1")).resolves.toEqual(files);
    await expect(createHttpRunSource("http://host").readArtifact("run-1", "result.0.json")).resolves.toBe(
      '{"components":[]}',
    );

    expect(fetchMock.mock.calls[0][0]).toBe("http://host/runs/run-1/files");
    expect(fetchMock.mock.calls[1][0]).toBe("http://host/runs/run-1/files/result.0.json");
  });

  it("encodes an artifact path as a single segment", async () => {
    const fetchMock = stubFetch(response(200, null, "{}"));
    await createHttpRunSource("http://host").readArtifact("run-1", "../run.json");
    expect(fetchMock.mock.calls[0][0]).toBe("http://host/runs/run-1/files/..%2Frun.json");
  });

  it("surfaces the API error message and status", async () => {
    stubFetch(response(409, { error: "run moved on" }), response(409, { error: "run moved on" }));
    const source = createHttpRunSource("http://host");

    await expect(source.submitDecision("run-1", decision)).rejects.toMatchObject({
      name: "RunSourceError",
      message: "run moved on",
      status: 409,
    });
    await expect(source.submitDecision("run-1", decision)).rejects.toBeInstanceOf(RunSourceError);
  });

  it("falls back to the HTTP status when the body is not JSON", async () => {
    stubFetch(response(500, null, "boom"));
    await expect(createHttpRunSource("http://host").listRuns()).rejects.toMatchObject({
      message: "HTTP 500",
      status: 500,
    });
  });
});
