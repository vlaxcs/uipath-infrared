import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunDataSection } from "~/rundata/RunDataSection";
import { RunSourceError, type RunSource } from "~/runs/source";
import type { RunDetail, RunEvent, RunSummary } from "~/runs/types";

afterEach(cleanup);

function summary(id: string, status: RunSummary["status"] = "awaiting_approval"): RunSummary {
  return {
    schema_version: "1.0", id, project: "startup", status, step: "present", revision: 1, max_revisions: 2,
    started_at: "2026-11-14T09:00:00Z", updated_at: "2026-11-14T09:08:16Z",
  } as RunSummary;
}

function withResult(id: string, path: string | null): RunDetail {
  const events: RunEvent[] = [
    { seq: 1, at: "2026-11-14T09:00:00Z", step: "extract", status: "started", revision: 0, actor: { kind: "orchestrator" } },
  ] as RunEvent[];
  if (path) {
    events.push({
      seq: 2, at: "2026-11-14T09:06:39Z", step: "evaluate", status: "completed", revision: 0, actor: { kind: "orchestrator" },
      output: { contract: "result", file: { path, sha256: "0".repeat(64) } },
      decision: { kind: "proceed", reason: "ok" },
    } as RunEvent);
  }
  return { ...summary(id), events, inputs: {} } as unknown as RunDetail;
}

function fakeSource(runs: RunSummary[], details: Record<string, RunDetail>, files: Record<string, string>): RunSource {
  return {
    mode: "live",
    listRuns: vi.fn(async () => runs),
    getRun: vi.fn(async (id: string) => details[id]),
    startRun: vi.fn(),
    eventsAfter: vi.fn(async () => []),
    submitDecision: vi.fn(),
    listFiles: vi.fn(async () => []),
    readArtifact: vi.fn(async (id: string, path: string) => {
      const text = files[`${id}/${path}`];
      if (text === undefined) throw new RunSourceError("not found", 404);
      return text;
    }),
  };
}

function renderSection(source: RunSource, runId: string | null, onPickRun = vi.fn()) {
  render(
    <RunDataSection
      source={source}
      runId={runId}
      onPickRun={onPickRun}
      contract="result"
      noun="result"
      render={(document) => <p>winner {(document as { winner: string }).winner}</p>}
    />,
  );
  return onPickRun;
}

const RUNS = [summary("run-startup-0002"), summary("run-startup-0001", "completed")];
const DETAILS = { "run-startup-0002": withResult("run-startup-0002", "result.1.json"), "run-startup-0001": withResult("run-startup-0001", "result.0.json") };
const FILES = {
  "run-startup-0002/result.1.json": JSON.stringify({ winner: "agent-serverless-db-eu", candidates: [] }),
  "run-startup-0001/result.0.json": JSON.stringify({ winner: "managed_services", candidates: [] }),
};

describe("a section that shows one run's data", () => {
  it("shows the run that was opened, not the latest one", async () => {
    renderSection(fakeSource(RUNS, DETAILS, FILES), "run-startup-0001");
    expect(await screen.findByText("winner managed_services")).toBeTruthy();
  });

  it("shows the most recent run when none was opened", async () => {
    renderSection(fakeSource(RUNS, DETAILS, FILES), null);
    expect(await screen.findByText("winner agent-serverless-db-eu")).toBeTruthy();
  });

  it("reads the latest file of its kind that the run wrote", async () => {
    const source = fakeSource(RUNS, DETAILS, FILES);
    renderSection(source, "run-startup-0002");
    await screen.findByText("winner agent-serverless-db-eu");
    expect(source.readArtifact).toHaveBeenCalledWith("run-startup-0002", "result.1.json", expect.anything());
  });

  it("says there are no runs instead of showing sample data", async () => {
    renderSection(fakeSource([], {}, {}), null);
    expect(await screen.findByText("No runs yet")).toBeTruthy();
    expect(screen.queryByText(/winner/)).toBeNull();
  });

  it("says when the run has not written this file yet, and where it stands", async () => {
    renderSection(fakeSource([summary("run-startup-0003", "running")], { "run-startup-0003": withResult("run-startup-0003", null) }, {}), null);
    expect(await screen.findByText(/run-startup-0003 has no result yet/)).toBeTruthy();
  });

  it("lets another run be picked", async () => {
    const onPickRun = renderSection(fakeSource(RUNS, DETAILS, FILES), "run-startup-0002");
    const picker = await screen.findByLabelText("Run");
    fireEvent.change(picker, { target: { value: "run-startup-0001" } });
    expect(onPickRun).toHaveBeenCalledWith("run-startup-0001");
  });

  it("offers a retry when the file cannot be read", async () => {
    const source = fakeSource(RUNS, DETAILS, {});
    source.readArtifact = vi.fn(async () => {
      throw new RunSourceError("orchestrator unreachable", 0);
    });
    renderSection(source, "run-startup-0002");
    expect(await screen.findByText(/orchestrator unreachable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("refuses a file that is not the document it should be", async () => {
    renderSection(fakeSource(RUNS, DETAILS, { "run-startup-0002/result.1.json": "{not json" }), "run-startup-0002");
    expect(await screen.findByText(/result\.1\.json could not be read/)).toBeTruthy();
  });
});
