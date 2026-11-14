import { describe, expect, it } from "vitest";
import { makeCandidate, makeCost } from "~/candidates/fixtures";
import { deriveCandidateMetrics } from "~/candidates/metrics";
import type { Baseline } from "~/candidates/types";

const baseline: Baseline = { monthly_eur: 1200, availability_pct: 98, violations: [] };

describe("candidate metrics", () => {
  it("derives deltas against the baseline", () => {
    const metrics = deriveCandidateMetrics(
      makeCandidate({ cost: makeCost({ run_eur_month_now: 900 }), availability_pct: 99.5 }),
      baseline,
    );
    expect(metrics.monthlyDeltaEur).toBe(-300);
    expect(metrics.availabilityDeltaPp).toBeCloseTo(1.5);
    expect(metrics.runAtHorizonBase).toBeNull();
    expect(metrics.paybackMonths).toBe(2);
  });

  it("carries the optional cost blocks and scenario values", () => {
    const metrics = deriveCandidateMetrics(
      makeCandidate({
        cost: makeCost({
          run_eur_month_at_horizon: { low: 700, base: 800, high: 900 },
          security_remediation: { effort_hours: 10, one_off_eur: 1000, run_delta_eur_month: 30 },
          onprem_platform: {
            platform: "onprem-dc1",
            capacity_share: 0.5,
            capex_amortised_eur_month: 100,
            power_cooling_eur_month: 20,
            colocation_eur_month: 30,
            disk_replacement_eur_month: 5,
            staff_eur_month: 200,
          },
        }),
      }),
      baseline,
    );
    expect(metrics.runAtHorizonBase).toBe(800);
    expect(metrics.horizonByScenario.base).toBe(1000);
    expect(metrics.securityRemediation?.one_off_eur).toBe(1000);
    expect(metrics.onpremPlatform?.platform).toBe("onprem-dc1");
  });

  it("keeps null scores, ranks and payback", () => {
    const metrics = deriveCandidateMetrics(
      makeCandidate({
        score: null,
        rank: null,
        payback_months: null,
        rank_by_scenario: null,
        cutover_downtime_hours: undefined,
      }),
      baseline,
    );
    expect(metrics.score).toBeNull();
    expect(metrics.rank).toBeNull();
    expect(metrics.paybackMonths).toBeNull();
    expect(metrics.rankByScenario).toBeNull();
    expect(metrics.cutoverDowntimeHours).toBeNull();
  });
});
