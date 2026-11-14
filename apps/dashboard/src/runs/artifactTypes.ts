export type InfraArtifactComponent = {
  id?: string;
  kind?: string;
  stack?: string;
  status?: string;
  region?: string;
  zones?: number;
  quantity?: number;
  cost?: { monthly_eur?: { value?: number } };
  [key: string]: unknown;
};

export type InfraArtifact = {
  project?: string;
  source?: { extractor?: string; is_mock?: boolean };
  stacks?: { id?: string; name?: string }[];
  components?: InfraArtifactComponent[];
  edges?: unknown[];
  [key: string]: unknown;
};

export type Finding = {
  id?: string;
  title?: string;
  category?: string;
  stack?: string;
  confidence?: string;
  risk?: string;
  resources?: string[];
  evidence?: string | string[];
  recommendation?: string;
  migration_notes?: string;
  [key: string]: unknown;
};

export type FindingsArtifact = { findings?: Finding[]; [key: string]: unknown };

export type CandidateAction = {
  component?: string;
  action?: string;
  signal?: string;
  reason?: string;
  to?: string;
  [key: string]: unknown;
};

export type Candidate = {
  id?: string;
  builds_on?: string;
  revises?: string;
  rationale?: string;
  actions?: CandidateAction[];
  [key: string]: unknown;
};

export type CandidatesArtifact = {
  revision?: number;
  proposed_by?: string;
  candidates?: Candidate[];
  [key: string]: unknown;
};

export type ResultCandidate = {
  id?: string;
  source?: string;
  feasible?: boolean;
  rank?: number;
  cost?: { run_eur_month_now?: number };
  availability_pct?: number;
  risk?: number;
  effort_hours?: number;
  payback_months?: number;
  violations?: { constraint?: string; detail?: string }[];
  lost_because?: { reason?: string; detail?: string } | null;
  [key: string]: unknown;
};

export type ResultArtifact = {
  baseline?: { monthly_eur?: number; availability_pct?: number; violations?: unknown[] };
  winner?: string;
  candidates?: ResultCandidate[];
  [key: string]: unknown;
};

export type RehearsalPhase = {
  duration_s?: number;
  availability_pct?: number | { value?: number };
  latency_p95_ms?: number | { value?: number };
  requests_total?: number;
  requests_failed?: number;
  [key: string]: unknown;
};

export type RehearsalComponent = {
  component_id?: string;
  kind?: string;
  status?: string;
  note?: string;
  [key: string]: unknown;
};

export type RehearsalFailure = {
  type?: string;
  target_component?: string;
  injected_at_s?: number;
  duration_s?: number;
  detail?: string;
  [key: string]: unknown;
};

export type RehearsalArtifact = {
  candidate_id?: string;
  verdict?: {
    passed?: boolean;
    reason?: string;
    measured_availability_pct?: number;
    forecast_min_availability_pct?: number;
    gap_pct?: number;
    [key: string]: unknown;
  };
  failure?: RehearsalFailure;
  phases?: Record<string, RehearsalPhase>;
  component_results?: RehearsalComponent[];
  x_decision?: { reason?: string };
  [key: string]: unknown;
};
