import { describe, expect, it } from "vitest";
import { cutSampleRun, failedRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import { RUN_STEPS, deriveStepStates } from "~/runs/stepProgress";
import type { RunDetail } from "~/runs/types";

describe("deriving step states", () => {
  it("marks every step done for the completed sample", () => {
    expect(deriveStepStates(sampleRun.events, sampleRun)).toEqual({
      extract: "done",
      investigate: "done",
      propose: "done",
      evaluate: "done",
      present: "done",
      rehearse: "done",
    });
  });

  it("keeps present awaiting after keep_analyses", () => {
    const run = cutSampleRun(15);
    expect(deriveStepStates(run.events, run)).toMatchObject({ present: "awaiting", rehearse: "pending" });
  });

  it("shows the current step in progress", () => {
    const run = cutSampleRun(7);
    expect(deriveStepStates(run.events, run).evaluate).toBe("current");
  });

  it("marks a failed step failed and leaves the rest pending", () => {
    expect(deriveStepStates(failedRun.events, failedRun)).toMatchObject({
      evaluate: "failed",
      present: "pending",
      rehearse: "pending",
    });
  });

  it("starts with every step pending", () => {
    const empty: RunDetail = { ...sampleRun, events: [] };
    expect(deriveStepStates([], empty)).toEqual({
      extract: "pending",
      investigate: "pending",
      propose: "pending",
      evaluate: "pending",
      present: "pending",
      rehearse: "pending",
    });
    expect(RUN_STEPS).toHaveLength(6);
  });
});
