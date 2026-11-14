import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError, type RunLogChunk, type RunSource } from "~/runs/source";
import { StepLog } from "~/runs/StepLog";
import type { RunStep } from "~/runs/types";
import { useStepLog } from "~/runs/useStepLog";

afterEach(cleanup);

function Probe({ source, step }: { source: RunSource; step: RunStep | null }) {
  const log = useStepLog(source, "run-startup-0001", step, 10);
  return step ? <StepLog step={step} log={log} /> : null;
}

function sourceReading(chunks: (RunLogChunk | Error)[]) {
  const readLog = vi.fn(async () => {
    const next = chunks.length > 1 ? chunks.shift()! : chunks[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return { source: { ...sampleRunSource, mode: "live" as const, readLog }, readLog };
}

describe("a step's log", () => {
  it("streams while the step runs, asking from where it stopped", async () => {
    const { source, readLog } = sourceReading([
      { text: "reading ec2\n", next: 12, running: true },
      { text: "reading rds\n", next: 24, running: true },
      { text: "", next: 24, running: false },
    ]);
    render(<Probe source={source} step="extract" />);
    await waitFor(() => expect(screen.getByLabelText("Extract log").textContent).toBe("reading ec2\nreading rds\n"));
    expect(readLog).toHaveBeenNthCalledWith(1, "run-startup-0001", "extract", 0, expect.anything());
    expect(readLog).toHaveBeenNthCalledWith(2, "run-startup-0001", "extract", 12, expect.anything());
    await waitFor(() => expect(screen.queryByText("live")).toBeNull());
    const calls = readLog.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(readLog.mock.calls.length).toBe(calls);
  });

  it("says live while the step is still running", async () => {
    const { source } = sourceReading([{ text: "investigating\n", next: 14, running: true }]);
    render(<Probe source={source} step="investigate" />);
    expect(await screen.findByText("live")).toBeTruthy();
  });

  it("says when the step has not started", async () => {
    const { source } = sourceReading([new RunSourceError("rehearse has not started", 404)]);
    render(<Probe source={source} step="rehearse" />);
    expect(await screen.findByText("Not started.")).toBeTruthy();
  });

  it("says when the log cannot be read", async () => {
    const { source } = sourceReading([new RunSourceError("orchestrator unreachable", 0)]);
    render(<Probe source={source} step="extract" />);
    expect((await screen.findByRole("alert")).textContent).toContain("orchestrator unreachable");
  });
});
