import { describe, expect, it } from "vitest";
import result from "../../../../contracts/result.example.json";
import { emptyCost, runCostFromResult } from "~/domain/costs";

describe("reading a result's prices", () => {
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
        candidates: [{ id: "cheap", cost: {}, monthly_eur: 40 }],
      }),
    ).toEqual({ before: 100, after: 40, winner: "cheap" });
  });

  it("keeps what it can without a winner or a baseline", () => {
    expect(runCostFromResult({ candidates: [] })).toEqual(emptyCost());
    expect(runCostFromResult({ baseline: { monthly_eur: 50 }, winner: null })).toEqual({
      before: 50,
      after: null,
      winner: null,
    });
    expect(runCostFromResult(null)).toEqual(emptyCost());
  });
});
