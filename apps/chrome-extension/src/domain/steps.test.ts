import { describe, expect, it } from "vitest";
import runExample from "../../../../contracts/run.example.json";
import { deriveStepStates } from "~/domain/steps";
import type { RunDetail, RunEvent } from "~/domain/types";

const sample = runExample as unknown as RunDetail;

function cut(seq: number, overrides: Partial<RunDetail> = {}): RunDetail {
  return {
    ...sample,
    ...overrides,
    events: sample.events.filter((event) => event.seq <= seq),
  };
}

const failedEvaluate: RunEvent = {
  seq: 9,
  at: "2026-11-14T09:06:40Z",
  step: "evaluate",
  status: "failed",
  revision: 0,
  actor: { kind: "orchestrator" },
  decision: { kind: "stop", reason: "the engine could not price the baseline" },
};

describe("deriving step states", () => {
  it("marks the finished pipeline", () => {
    expect(deriveStepStates(sample).map((entry) => entry.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("marks the step waiting at the layout gate", () => {
    const run = cut(14, { status: "awaiting_approval", step: "present", awaiting: "layout" });
    expect(deriveStepStates(run)).toEqual([
      { step: "extract", state: "done" },
      { step: "investigate", state: "done" },
      { step: "propose", state: "done" },
      { step: "evaluate", state: "done" },
      { step: "present", state: "awaiting" },
      { step: "rehearse", state: "pending" },
    ]);
  });

  it("leaves unstarted steps pending and marks a failure", () => {
    const run = cut(8, { status: "failed", step: "evaluate" });
    run.events = [...run.events.filter((event) => event.seq <= 7), failedEvaluate].map((event) =>
      event.seq === 9 ? { ...event, revision: 0 } : event,
    );
    const states = deriveStepStates(run);
    expect(states.find((entry) => entry.step === "evaluate")).toEqual({
      step: "evaluate",
      state: "failed",
    });
    expect(states.find((entry) => entry.step === "rehearse")).toEqual({
      step: "rehearse",
      state: "pending",
    });
  });
});
