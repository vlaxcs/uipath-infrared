import {
  formatConstraintValue,
  formatDeltaPp,
  formatDistance,
  formatEur,
  formatHours,
  formatMonths,
  formatPercent,
  formatRank,
  formatRisk,
  formatSaving,
  formatScore,
  formatSignedEur,
} from "~/candidates/format";
import {
  actionLabel,
  confidenceMeta,
  constraintLabel,
  flagLabels,
  isNoOpAction,
  layerLabel,
  lostReasonMeta,
  sourceLabel,
} from "~/candidates/labels";
import { deriveCandidateMetrics } from "~/candidates/metrics";
import { defaultCandidateId, orderedCandidates, winnerCandidate } from "~/candidates/order";
import { buildSteps, type Step } from "~/candidates/steps";
import type { Action, Baseline, Candidate, ResultDocument, Violation } from "~/candidates/types";
import type { StatusTone } from "~/ui/StatusBadge";

export type Metric = { label: string; value: string };
export type CostLine = { label: string; value: string };

export type ViolationView = {
  id: string;
  constraint: string;
  component: string;
  detail: string;
  values: string;
};

export type ConfidenceView = { label: string; tone: StatusTone; reason: string };
export type WhyLostView = { label: string; tone: StatusTone; detail: string };

export type StepView = {
  number: number;
  component: string;
  action: string;
  fromTo: string | null;
  reason: string | null;
  signal: string | null;
  saving: string;
  effort: string | null;
  confidence: string;
  isNoOp: boolean;
};

export type StepGroupView = { key: string; label: string; start: number; steps: StepView[] };
export type StepsModel = { groups: StepGroupView[]; summary: string };

export type CandidateView = {
  id: string;
  isWinner: boolean;
  statusLabel: string;
  statusTone: StatusTone;
  rankLabel: string;
  sourceLabel: string | null;
  pareto: boolean;
  whyLost: WhyLostView | null;
  headline: Metric[];
  secondary: Metric[];
  costLines: CostLine[];
  securityRemediation: Metric[];
  onpremPlatform: Metric[];
  violations: ViolationView[];
  confidence: ConfidenceView;
  flags: string[];
  buildsOn: string | null;
  steps: StepsModel | null;
};

export type BaselineView = {
  monthly: string;
  availability: string;
  violationCount: number;
  violations: ViolationView[];
  confidence: ConfidenceView | null;
  flags: string[];
};

export type NothingFeasibleView = {
  closestId: string | null;
  distance: string | null;
  blockedBy: ViolationView[];
};

export type CandidatesModel = {
  context: {
    project: string;
    forecast: string;
    horizon: string;
    currency: string;
    catalogIllustrative: boolean;
    schemaVersion: string;
    schemaSupported: boolean;
  };
  counts: { total: number; feasible: number; infeasible: number; pareto: number };
  baseline: BaselineView;
  candidates: CandidateView[];
  winnerId: string | null;
  defaultId: string | null;
  nothingFeasible: NothingFeasibleView | null;
  flags: string[];
};

function violationViews(violations: readonly Violation[]): ViolationView[] {
  return violations.map((violation, index) => ({
    id: `${violation.constraint}-${violation.component ?? "estate"}-${index}`,
    constraint: constraintLabel(violation.constraint),
    component: violation.component ?? "Whole estate",
    detail: violation.detail,
    values: violationValues(violation),
  }));
}

function violationValues(violation: Violation): string {
  const parts: string[] = [];
  if (violation.actual !== null) {
    parts.push(`actual ${formatConstraintValue(violation.constraint, violation.actual)}`);
  }
  if (violation.limit !== null) {
    parts.push(`limit ${formatConstraintValue(violation.constraint, violation.limit)}`);
  }
  parts.push(`distance ${formatDistance(violation.distance)}`);
  return parts.join(" · ");
}

function confidenceView(confidence: string, reason: string | undefined): ConfidenceView {
  return { ...confidenceMeta(confidence), reason: reason ?? "" };
}

function whyLost(candidate: Candidate, isWinner: boolean): WhyLostView | null {
  if (isWinner) return null;
  if (candidate.lost_because) {
    const meta = lostReasonMeta(candidate.lost_because.reason);
    return { label: meta.label, tone: meta.tone, detail: candidate.lost_because.detail };
  }
  return { label: "Not selected", tone: "neutral", detail: "The engine did not select this candidate." };
}

function costLines(candidate: Candidate): CostLine[] {
  const cost = candidate.cost;
  const lines: CostLine[] = [
    { label: "Expected total, horizon", value: formatEur(cost.expected_total_eur) },
    { label: "Run cost now", value: `${formatEur(cost.run_eur_month_now)}/month` },
  ];
  if (cost.run_eur_month_at_horizon) {
    lines.push({ label: "Run at horizon", value: `${formatEur(cost.run_eur_month_at_horizon.base)}/month` });
  }
  lines.push(
    {
      label: "Horizon run cost",
      value: `${formatEur(cost.horizon_by_scenario.base)} base · ${formatEur(cost.horizon_by_scenario.low)} low · ${formatEur(cost.horizon_by_scenario.high)} high`,
    },
    { label: "Migration, one-off", value: formatEur(cost.migration_eur) },
    { label: "Ops", value: `${formatEur(cost.ops_eur_month)}/month` },
    { label: "Expected outage loss", value: `${formatEur(cost.expected_outage_loss_eur_year)}/year` },
  );
  return lines;
}

function securityRemediationLines(candidate: Candidate): Metric[] {
  const remediation = candidate.cost.security_remediation;
  if (!remediation) return [];
  return [
    { label: "Effort", value: formatHours(remediation.effort_hours) },
    { label: "One-off", value: formatEur(remediation.one_off_eur) },
    { label: "Run cost change", value: `${formatSignedEur(remediation.run_delta_eur_month)}/month` },
  ];
}

function onpremPlatformLines(candidate: Candidate): Metric[] {
  const platform = candidate.cost.onprem_platform;
  if (!platform) return [];
  const lines: Metric[] = [
    { label: "Platform", value: platform.platform },
    { label: "Capacity share", value: formatPercent(platform.capacity_share * 100) },
    { label: "Capex amortised", value: `${formatEur(platform.capex_amortised_eur_month)}/month` },
    { label: "Power and cooling", value: `${formatEur(platform.power_cooling_eur_month)}/month` },
    { label: "Colocation", value: `${formatEur(platform.colocation_eur_month)}/month` },
    { label: "Disk replacement", value: `${formatEur(platform.disk_replacement_eur_month)}/month` },
    { label: "Staff", value: `${formatEur(platform.staff_eur_month)}/month` },
  ];
  if (platform.platforms_needed !== undefined) {
    lines.splice(1, 0, { label: "Platforms needed", value: `${platform.platforms_needed}` });
  }
  if (platform.capex_eur !== undefined) {
    lines.push({ label: "Capex", value: formatEur(platform.capex_eur) });
  }
  return lines;
}

function stepView(step: Step): StepView {
  const action: Action = step.action;
  const fromTo =
    action.from && action.to ? `${action.from} → ${action.to}` : action.from ?? action.to ?? null;
  return {
    number: step.number,
    component: action.component,
    action: actionLabel(action.action),
    fromTo,
    reason: action.reason ?? null,
    signal: action.signal ?? null,
    saving: action.action === "flag" ? "No priced change" : formatSaving(action.saving_eur_month),
    effort: action.effort_hours !== undefined ? formatHours(action.effort_hours) : null,
    confidence: confidenceMeta(action.confidence).label,
    isNoOp: isNoOpAction(action.action),
  };
}

function stepsModel(actions: readonly Action[]): StepsModel {
  const steps = buildSteps(actions);
  const groups = steps.groups.map((group) => ({
    key: `${group.layer ?? "other"}-${group.start}`,
    label: layerLabel(group.layer),
    start: group.start,
    steps: group.steps.map(stepView),
  }));
  const parts = [
    `${steps.total} ${steps.total === 1 ? "step" : "steps"}`,
    `${steps.changes} ${steps.changes === 1 ? "change" : "changes"}`,
  ];
  if (steps.findings > 0) {
    parts.push(`${steps.findings} ${steps.findings === 1 ? "finding" : "findings"}`);
  }
  if (steps.keeps > 0) {
    parts.push(`${steps.keeps} ${steps.keeps === 1 ? "keep" : "keeps"}`);
  }
  return { groups, summary: parts.join(" · ") };
}

function candidateView(candidate: Candidate, baseline: Baseline, winnerId: string | null): CandidateView {
  const metrics = deriveCandidateMetrics(candidate, baseline);
  const isWinner = candidate.id === winnerId;
  const status = isWinner
    ? { label: "Winner", tone: "completed" as const }
    : candidate.feasible
      ? { label: "Feasible", tone: "neutral" as const }
      : { label: "Infeasible", tone: "failed" as const };
  const rankByScenario = metrics.rankByScenario;

  return {
    id: candidate.id,
    isWinner,
    statusLabel: status.label,
    statusTone: status.tone,
    rankLabel: formatRank(metrics.rank),
    sourceLabel: candidate.source ? sourceLabel(candidate.source) : null,
    pareto: metrics.pareto,
    whyLost: whyLost(candidate, isWinner),
    headline: [
      { label: "Expected total", value: formatEur(metrics.expectedTotalEur) },
      {
        label: "Availability",
        value: `${formatPercent(metrics.availabilityPct)} (${formatDeltaPp(metrics.availabilityDeltaPp)} vs today)`,
      },
      { label: "Risk", value: formatRisk(metrics.risk) },
      { label: "Effort", value: formatHours(metrics.effortHours) },
    ],
    secondary: [
      {
        label: "Run cost now",
        value: `${formatEur(metrics.runEurMonthNow)}/month (${formatSignedEur(metrics.monthlyDeltaEur)} vs today)`,
      },
      { label: "Payback", value: formatMonths(metrics.paybackMonths) },
      {
        label: "Score",
        value: metrics.score === null ? "Not scored" : `${formatScore(metrics.score)} (lower is better)`,
      },
      { label: "Rank", value: formatRank(metrics.rank) },
      {
        label: "Rank by scenario",
        value: rankByScenario
          ? `low ${formatRank(rankByScenario.low)} · base ${formatRank(rankByScenario.base)} · high ${formatRank(rankByScenario.high)}`
          : "Not scored",
      },
      { label: "Pareto frontier", value: metrics.pareto ? "Yes" : "No" },
      {
        label: "Cutover downtime",
        value: metrics.cutoverDowntimeHours === null ? "Not stated" : formatHours(metrics.cutoverDowntimeHours),
      },
    ],
    costLines: costLines(candidate),
    securityRemediation: securityRemediationLines(candidate),
    onpremPlatform: onpremPlatformLines(candidate),
    violations: violationViews(candidate.violations),
    confidence: confidenceView(candidate.confidence, candidate.confidence_reason),
    flags: flagLabels(candidate.flags),
    buildsOn: candidate.builds_on ?? null,
    steps: isWinner ? stepsModel(candidate.actions) : null,
  };
}

export function buildCandidatesModel(result: ResultDocument): CandidatesModel {
  const ordered = orderedCandidates(result);
  const winner = winnerCandidate(result);
  const winnerId = winner?.id ?? null;
  const feasible = result.candidates.filter((candidate) => candidate.feasible).length;
  const closest = result.closest_if_none_feasible;

  return {
    context: {
      project: result.inputs.infra,
      forecast: result.inputs.forecast,
      horizon: `${result.inputs.horizon_months} months`,
      currency: result.inputs.currency,
      catalogIllustrative: result.inputs.catalog_illustrative,
      schemaVersion: result.schema_version,
      schemaSupported: /^1\.\d+$/.test(result.schema_version),
    },
    counts: {
      total: result.candidates.length,
      feasible,
      infeasible: result.candidates.length - feasible,
      pareto: result.candidates.filter((candidate) => candidate.pareto).length,
    },
    baseline: {
      monthly: `${formatEur(result.baseline.monthly_eur)}/month`,
      availability: formatPercent(result.baseline.availability_pct),
      violationCount: result.baseline.violations.length,
      violations: violationViews(result.baseline.violations),
      confidence: result.baseline.confidence
        ? confidenceView(result.baseline.confidence, result.baseline.confidence_reason)
        : null,
      flags: flagLabels(result.baseline.flags),
    },
    candidates: ordered.map((candidate) => candidateView(candidate, result.baseline, winnerId)),
    winnerId,
    defaultId: defaultCandidateId(result),
    nothingFeasible:
      result.winner === null
        ? {
            closestId: closest?.candidate ?? null,
            distance: closest ? formatDistance(closest.violation_distance) : null,
            blockedBy: violationViews(closest?.blocked_by ?? []),
          }
        : null,
    flags: flagLabels(result.flags),
  };
}
