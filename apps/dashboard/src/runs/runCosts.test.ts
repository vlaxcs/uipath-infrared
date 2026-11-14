import { describe, expect, it } from "vitest";
import result from "../../../../contracts/result.example.json";
import { emptyCost, latestResultPath, runCostFromResult } from "~/runs/runCosts";

describe("reading a run's prices", () => {
  it("takes the before price from the baseline and the after price from the winner", () => {
    expect(runCostFromResult(result)).toEqual({
      before: 133308,
      after: 74365,
      winner: "consolidate",
    });
  });

  it("falls back to the candidate's flat monthly price", () => {
    expect(
      runCostFromResult({
        baseline: { monthly_eur: 100 },
        winner: "cheap",
        candidates: [{ id: "cheap", feasible: true, monthly_eur: 40 }],
      }),
    ).toEqual({ before: 100, after: 40, winner: "cheap" });
  });

  it("keeps what it can when the result has no winner or no baseline", () => {
    expect(runCostFromResult({ candidates: [] })).toEqual(emptyCost());
    expect(runCostFromResult({ baseline: { monthly_eur: 50 }, winner: null })).toEqual({
      before: 50,
      after: null,
      winner: null,
    });
    expect(runCostFromResult(null)).toEqual(emptyCost());
  });
});

describe("finding the latest result artifact", () => {
  it("picks the highest revision and ignores other files", () => {
    expect(
      latestResultPath(["infra.json", "result.0.json", "result.1.json", "feedback.1.json", "result.2.json"]),
    ).toBe("result.2.json");
  });

  it("returns null when the run has not been evaluated", () => {
    expect(latestResultPath(["infra.json", "findings.json", "candidates.0.json"])).toBeNull();
  });
});
