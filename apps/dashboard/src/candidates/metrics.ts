import type {
  Baseline,
  Candidate,
  OnPremPlatformCost,
  ScenarioRanks,
  ScenarioValues,
  SecurityRemediationCost,
} from "~/candidates/types";

export type CandidateMetrics = {
  expectedTotalEur: number;
  runEurMonthNow: number;
  monthlyDeltaEur: number;
  horizonRunEur: number;
  horizonByScenario: ScenarioValues;
  runAtHorizonBase: number | null;
  migrationEur: number;
  opsEurMonth: number;
  outageLossEurYear: number;
  availabilityPct: number;
  availabilityDeltaPp: number;
  risk: number;
  effortHours: number;
  paybackMonths: number | null;
  score: number | null;
  rank: number | null;
  rankByScenario: ScenarioRanks | null;
  pareto: boolean;
  cutoverDowntimeHours: number | null;
  securityRemediation: SecurityRemediationCost | null;
  onpremPlatform: OnPremPlatformCost | null;
};

export function deriveCandidateMetrics(candidate: Candidate, baseline: Baseline): CandidateMetrics {
  const cost = candidate.cost;
  return {
    expectedTotalEur: cost.expected_total_eur,
    runEurMonthNow: cost.run_eur_month_now,
    monthlyDeltaEur: cost.run_eur_month_now - baseline.monthly_eur,
    horizonRunEur: cost.horizon_run_eur,
    horizonByScenario: cost.horizon_by_scenario,
    runAtHorizonBase: cost.run_eur_month_at_horizon?.base ?? null,
    migrationEur: cost.migration_eur,
    opsEurMonth: cost.ops_eur_month,
    outageLossEurYear: cost.expected_outage_loss_eur_year,
    availabilityPct: candidate.availability_pct,
    availabilityDeltaPp: candidate.availability_pct - baseline.availability_pct,
    risk: candidate.risk,
    effortHours: candidate.effort_hours,
    paybackMonths: candidate.payback_months,
    score: candidate.score,
    rank: candidate.rank,
    rankByScenario: candidate.rank_by_scenario,
    pareto: candidate.pareto,
    cutoverDowntimeHours: candidate.cutover_downtime_hours ?? null,
    securityRemediation: cost.security_remediation ?? null,
    onpremPlatform: cost.onprem_platform ?? null,
  };
}
