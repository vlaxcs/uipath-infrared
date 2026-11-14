export type Confidence = "high" | "medium" | "low";
export type Source = "engine" | "agent";
export type ActionKind =
  | "keep"
  | "delete"
  | "stop"
  | "resize"
  | "scale"
  | "autoscale"
  | "move"
  | "remediate"
  | "flag";
export type LostReason = "constraint" | "cost" | "risk" | "effort" | "payback";

export type ScenarioValues = { low: number; base: number; high: number };
export type ScenarioRanks = { low: number; base: number; high: number };

export type Violation = {
  constraint: string;
  component: string | null;
  detail: string;
  actual: number | string | null;
  limit: number | string | null;
  distance: number;
};

export type Action = {
  component: string;
  action: ActionKind;
  layer?: string;
  signal?: string;
  reason?: string;
  from?: string;
  to?: string;
  saving_eur_month: number;
  effort_hours?: number;
  confidence: Confidence;
  confidence_reason: string;
};

export type SecurityRemediationCost = {
  effort_hours: number;
  one_off_eur: number;
  run_delta_eur_month: number;
};

export type OnPremPlatformCost = {
  platform: string;
  platforms_needed?: number;
  capacity_share: number;
  capex_eur?: number;
  capex_amortised_eur_month: number;
  power_cooling_eur_month: number;
  colocation_eur_month: number;
  disk_replacement_eur_month: number;
  staff_eur_month: number;
};

export type Cost = {
  run_eur_month_now: number;
  run_eur_month_at_horizon?: ScenarioValues;
  horizon_by_scenario: ScenarioValues;
  horizon_run_eur: number;
  migration_eur: number;
  ops_eur_month: number;
  expected_outage_loss_eur_year: number;
  expected_total_eur: number;
  security_remediation?: SecurityRemediationCost;
  onprem_platform?: OnPremPlatformCost;
};

export type LostBecause = { reason: LostReason; detail: string };

export type Candidate = {
  id: string;
  source?: Source;
  builds_on?: string | null;
  feasible: boolean;
  violations: Violation[];
  violation_distance: number;
  actions: Action[];
  cost: Cost;
  availability_pct: number;
  risk: number;
  effort_hours: number;
  cutover_downtime_hours?: number;
  payback_months: number | null;
  score: number | null;
  pareto: boolean;
  rank: number | null;
  rank_by_scenario: ScenarioRanks | null;
  lost_because: LostBecause | null;
  confidence: Confidence;
  confidence_reason: string;
  flags?: string[];
};

export type ClosestIfNoneFeasible = {
  candidate: string;
  violation_distance: number;
  blocked_by: Violation[];
};

export type ResultInputs = {
  infra: string;
  forecast: string;
  catalog_illustrative: boolean;
  horizon_months: number;
  currency: "EUR";
};

export type Baseline = {
  monthly_eur: number;
  availability_pct: number;
  violations: Violation[];
  confidence?: Confidence;
  confidence_reason?: string;
  flags?: string[];
};

export type ResultDocument = {
  schema_version: string;
  inputs: ResultInputs;
  baseline: Baseline;
  candidates: Candidate[];
  winner: string | null;
  closest_if_none_feasible: ClosestIfNoneFeasible | null;
  flags?: string[];
};
