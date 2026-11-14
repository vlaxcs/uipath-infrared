import { describe, expect, it } from "vitest";
import { decisionConflictRehearsal, makeRehearsal } from "~/rehearsal/fixtures";
import { failedRehearsal, sampleRehearsal } from "~/rehearsal/sampleRehearsal";
import { buildVerdict } from "~/rehearsal/verdict";

describe("the rehearsal verdict", () => {
  it("reads the passed contract sample and derives the next step", () => {
    const verdict = buildVerdict(sampleRehearsal);
    expect(verdict.passed).toBe(true);
    expect(verdict.label).toBe("Passed");
    expect(verdict.tone).toBe("completed");
    expect(verdict.measured).toBe("99.94%");
    expect(verdict.threshold).toBe("99.9%");
    expect(verdict.gap).toBe("+0.04 pp");
    expect(verdict.gapDerived).toBe(false);
    expect(verdict.reason).toContain("failover completed within 2s");
    expect(verdict.decision.label).toBe("Proceed");
    expect(verdict.decision.source).toBe("derived");
    expect(verdict.decision.sourceLabel).toContain("Derived from the verdict");
    expect(verdict.decision.conflict).toBe(false);
  });

  it("uses the recorded decision from the real sandbox output", () => {
    const verdict = buildVerdict(failedRehearsal);
    expect(verdict.passed).toBe(false);
    expect(verdict.label).toBe("Failed");
    expect(verdict.measured).toBe("85.312%");
    expect(verdict.threshold).toBe("99.5%");
    expect(verdict.gap).toBe("-14.188 pp");
    expect(verdict.decision.label).toBe("Revise");
    expect(verdict.decision.source).toBe("recorded");
    expect(verdict.decision.reason).toContain("falls short of threshold");
    expect(verdict.decision.conflict).toBe(false);
  });

  it("derives the gap when the file omits it", () => {
    const verdict = buildVerdict(
      makeRehearsal({
        verdict: {
          passed: true,
          forecast_min_availability_pct: 99.9,
          measured_availability_pct: 99.95,
        },
      }),
    );
    expect(verdict.gap).toBe("+0.05 pp");
    expect(verdict.gapDerived).toBe(true);
  });

  it("flags a recorded decision that disagrees with the verdict", () => {
    const verdict = buildVerdict(decisionConflictRehearsal);
    expect(verdict.decision.label).toBe("Proceed");
    expect(verdict.decision.source).toBe("recorded");
    expect(verdict.decision.conflict).toBe(true);
  });
});
