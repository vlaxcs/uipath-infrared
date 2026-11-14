export type Provenance = "observed" | "estimated" | "synthetic";
export type TrafficPattern = "constant" | "ramp" | "burst" | "diurnal";
export type FailureType =
  | "instance_stop"
  | "task_stop"
  | "zone_down"
  | "network_partition"
  | "resource_exhaustion";
export type ComponentStatus = "healthy" | "degraded" | "failed";
export type PhaseKey = "baseline" | "failure" | "recovery";
export type TeardownStatus = "success" | "partial" | "failed";

export type Metric = {
  value: number;
  unit?: string;
  provenance: Provenance | string;
  basis?: string;
};

export type TrafficProfile = {
  pattern: TrafficPattern | string;
  duration_s: number;
  target_endpoint: string;
  requests_per_second?: number;
  peak_requests_per_second?: number;
  total_requests?: number;
};

export type FailureInjection = {
  type: FailureType | string;
  target_component: string;
  injected_at_s: number;
  duration_s: number;
  detail?: string;
};

export type PhaseMeasurement = {
  duration_s: number;
  availability_pct?: Metric;
  latency_p50_ms?: Metric;
  latency_p95_ms?: Metric;
  latency_p99_ms?: Metric;
  requests_total?: number;
  requests_successful?: number;
  requests_failed?: number;
  error_rate_pct?: Metric;
};

export type RehearsalPhases = {
  baseline: PhaseMeasurement;
  failure: PhaseMeasurement;
  recovery: PhaseMeasurement;
};

export type ComponentResult = {
  component_id: string;
  kind: string;
  status: ComponentStatus | string;
  availability_pct?: Metric;
  cpu_pct?: Metric;
  memory_pct?: Metric;
  note?: string;
};

export type RehearsalVerdict = {
  passed: boolean;
  forecast_min_availability_pct: number;
  measured_availability_pct: number;
  gap_pct?: number;
  reason?: string;
};

export type RehearsalTimestamps = {
  started_at: string;
  completed_at: string;
  elapsed_s?: number;
};

export type RehearsalInfrastructure = {
  vpc_id?: string;
  name_prefix?: string;
  endpoint?: string;
  components_created?: string[];
  teardown_status?: TeardownStatus | string;
};

export type Decision = { kind: string; reason?: string };

export type SkippedAction = {
  component: string;
  action: string;
  to?: string;
  reason?: string;
  [key: string]: unknown;
};

export type NotBuiltAction = {
  component_id: string;
  kind: string;
  action: string;
  reason?: string;
  [key: string]: unknown;
};

export type BuiltResource = {
  type: string;
  name: string;
  id: string;
  zone?: string;
  [key: string]: unknown;
};

export type BuiltComponent = {
  component_id: string;
  kind: string;
  sku?: string;
  zones?: number;
  detail?: string;
  resources?: BuiltResource[];
  [key: string]: unknown;
};

export type Readiness = {
  ready?: boolean;
  waited_s?: number;
  instances?: Record<string, string>;
  targets?: Record<string, string>;
  load_generator_samples_before_baseline?: number;
  [key: string]: unknown;
};

export type TeardownReport = {
  prefix?: string;
  checked_resource_types?: string[];
  remaining?: string[];
  [key: string]: unknown;
};

export type RehearsalDocument = {
  schema_version: string;
  candidate_id: string;
  forecast_id: string;
  traffic_profile: TrafficProfile;
  failure: FailureInjection;
  phases: RehearsalPhases;
  component_results?: ComponentResult[];
  verdict: RehearsalVerdict;
  timestamps: RehearsalTimestamps;
  infrastructure?: RehearsalInfrastructure;
  x_decision?: Decision;
  x_actions_skipped?: SkippedAction[];
  x_actions_not_built?: NotBuiltAction[];
  x_components_built?: BuiltComponent[];
  x_readiness?: Readiness;
  x_measurement_notes?: string[];
  x_teardown?: TeardownReport;
  [key: `x_${string}`]: unknown;
};
