import { describe, expect, it } from "vitest";
import { cutSampleRun, failedRun } from "~/runs/fixtures";
import { awaitingRuns, gateStep } from "~/runs/approvals";
import { sampleRun } from "~/runs/sampleRun";

describe("approvals", () => {
  it("keeps only the runs waiting at a known gate, newest first", () => {
    const layout = { ...cutSampleRun(14), id: "run-approvals-0001" };
    const plan = { ...cutSampleRun(20), id: "run-approvals-0002" };
    const noGate = { ...cutSampleRun(14), id: "run-approvals-0003", awaiting: undefined };
    const runs = [layout, sampleRun, failedRun, noGate, plan];

    expect(awaitingRuns(runs).map((run) => run.id)).toEqual([plan.id, layout.id]);
  });

  it("maps a gate to the step to pin", () => {
    expect(gateStep("layout")).toBe("present");
    expect(gateStep("plan")).toBe("rehearse");
    expect(gateStep(undefined)).toBeNull();
  });
});
