import { describe, expect, it } from "vitest";
import resultExample from "../../../../contracts/result.example.json";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import type { RunEvent } from "~/runs/types";
import { feasibleLayouts, latestRevisionFor, layoutOptions, layoutOptionsFromResult } from "~/runs/xCandidates";

function gateEvent(seq: number, status: RunEvent["status"], x_candidates?: RunEvent["x_candidates"]): RunEvent {
  return {
    seq,
    at: "2026-11-14T09:00:00Z",
    step: "present",
    status,
    revision: 1,
    actor: { kind: "orchestrator" },
    gate: "layout",
    ...(x_candidates ? { x_candidates } : {}),
  };
}

describe("layout options", () => {
  it("returns the candidates attached to the latest open layout gate", () => {
    const options = layoutOptions([
      gateEvent(1, "awaiting_approval", [{ id: "old", feasible: true }]),
      gateEvent(2, "approved"),
      gateEvent(3, "awaiting_approval", [{ id: "new", feasible: true }]),
    ]);

    expect(options.map((option) => option.id)).toEqual(["new"]);
  });

  it("returns no options when there is no layout gate", () => {
    expect(layoutOptions(sampleRun.events)).toEqual([]);
  });

  it("keeps feasible options ordered by rank and drops the rest", () => {
    expect(
      feasibleLayouts([
        { id: "no-rank", feasible: true },
        { id: "second", feasible: true, rank: 2 },
        { id: "first", feasible: true, rank: 1 },
        { id: "infeasible", feasible: false, rank: 0 },
      ]).map((option) => option.id),
    ).toEqual(["first", "second", "no-rank"]);
  });

  it("finds the latest revision of a step", () => {
    expect(latestRevisionFor(sampleRun.events, "evaluate")).toBe(1);
    expect(latestRevisionFor(cutSampleRun(8).events, "evaluate")).toBe(0);
    expect(latestRevisionFor(sampleRun.events, "rehearse")).toBe(1);
  });

  it("maps a result artifact back to layout options", () => {
    const options = layoutOptionsFromResult(resultExample);

    expect(options).toHaveLength(6);
    expect(options[0]).toMatchObject({
      id: "consolidate",
      feasible: true,
      rank: 1,
      monthly_eur: 74365,
      availability_pct: 99.95,
      risk: 0.31,
    });
    expect(options.find((option) => option.id === "do_nothing")).toMatchObject({ feasible: false });
  });

  it("ignores values that are not a result artifact", () => {
    expect(layoutOptionsFromResult(null)).toEqual([]);
    expect(layoutOptionsFromResult({ candidates: "none" })).toEqual([]);
    expect(layoutOptionsFromResult({ candidates: [{ id: 7 }] })).toEqual([]);
  });
});
