import { describe, expect, it } from "vitest";
import { sampleRun } from "~/runs/sampleRun";
import { deriveRunSummary } from "~/runs/summary";
import type { RunEvent } from "~/runs/types";

const cut = (seq: number): RunEvent[] => sampleRun.events.filter((event) => event.seq <= seq);

describe("deriving a run summary", () => {
  it("matches the sample's declared summary", () => {
    expect(deriveRunSummary(sampleRun.events)).toEqual({
      status: sampleRun.status,
      step: sampleRun.step,
      revision: sampleRun.revision,
      started_at: sampleRun.started_at,
      updated_at: sampleRun.updated_at,
      finished_at: sampleRun.finished_at,
    });
  });

  it("is awaiting the layout at seq 14", () => {
    expect(deriveRunSummary(cut(14))).toMatchObject({ status: "awaiting_approval", awaiting: "layout" });
  });

  it("keeps the layout gate open after keep_analyses", () => {
    expect(deriveRunSummary(cut(15))).toMatchObject({ status: "awaiting_approval", awaiting: "layout" });
  });

  it("closes the layout gate after pick_layout", () => {
    const summary = deriveRunSummary(cut(16));
    expect(summary.status).toBe("running");
    expect(summary).not.toHaveProperty("awaiting");
  });

  it("opens the plan gate and completes after approve_plan", () => {
    expect(deriveRunSummary(cut(20))).toMatchObject({ status: "awaiting_approval", awaiting: "plan" });
    expect(deriveRunSummary(cut(21))).toMatchObject({
      status: "completed",
      finished_at: "2026-11-14T09:21:40Z",
    });
  });

  it("orders by seq, not by timestamp", () => {
    const shuffled = [...cut(17)].reverse();
    expect(deriveRunSummary(shuffled).updated_at).toBe("2026-11-14T09:12:30Z");
  });

  it("reports a failed run", () => {
    const failed: RunEvent = {
      seq: 8,
      at: "2026-11-14T09:06:40Z",
      step: "evaluate",
      status: "failed",
      revision: 0,
      actor: { kind: "orchestrator" },
      decision: { kind: "stop", reason: "no baseline" },
    };

    expect(deriveRunSummary([...cut(7), failed])).toMatchObject({
      status: "failed",
      finished_at: "2026-11-14T09:06:40Z",
    });
  });
});
