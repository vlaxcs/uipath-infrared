import type {
  ComponentResult,
  Metric,
  PhaseMeasurement,
  RehearsalDocument,
} from "~/rehearsal/types";

export function makeMetric(value: number, overrides: Partial<Metric> = {}): Metric {
  return { value, unit: "percent", provenance: "synthetic", basis: "test probe", ...overrides };
}

export function makePhase(overrides: Partial<PhaseMeasurement> = {}): PhaseMeasurement {
  return {
    duration_s: 10,
    availability_pct: makeMetric(100),
    error_rate_pct: makeMetric(0),
    latency_p50_ms: makeMetric(40, { unit: "ms" }),
    latency_p95_ms: makeMetric(60, { unit: "ms" }),
    latency_p99_ms: makeMetric(90, { unit: "ms" }),
    requests_total: 100,
    requests_successful: 100,
    requests_failed: 0,
    ...overrides,
  };
}

export function makeComponent(overrides: Partial<ComponentResult> = {}): ComponentResult {
  return {
    component_id: "web-1",
    kind: "virtual_machine",
    status: "healthy",
    availability_pct: makeMetric(100),
    ...overrides,
  };
}

export function makeRehearsal(overrides: Partial<RehearsalDocument> = {}): RehearsalDocument {
  return {
    schema_version: "1.0",
    candidate_id: "layout-a",
    forecast_id: "forecast-a",
    traffic_profile: {
      pattern: "constant",
      duration_s: 30,
      target_endpoint: "http://sandbox.example:8080",
      requests_per_second: 10,
      total_requests: 300,
    },
    failure: {
      type: "instance_stop",
      target_component: "web-1",
      injected_at_s: 10,
      duration_s: 10,
      detail: "Stopped one instance to test the fallback",
    },
    phases: {
      baseline: makePhase(),
      failure: makePhase({ availability_pct: makeMetric(99.5) }),
      recovery: makePhase({ availability_pct: makeMetric(100) }),
    },
    component_results: [
      makeComponent({ component_id: "web-lb", kind: "load_balancer", status: "healthy" }),
      makeComponent({ component_id: "web-1", status: "failed", availability_pct: makeMetric(0) }),
      makeComponent({ component_id: "web-2", status: "healthy" }),
    ],
    verdict: {
      passed: true,
      forecast_min_availability_pct: 99.9,
      measured_availability_pct: 99.95,
      gap_pct: 0.05,
      reason: "The fallback held with one failed request",
    },
    timestamps: {
      started_at: "2026-01-01T10:00:00Z",
      completed_at: "2026-01-01T10:00:30Z",
      elapsed_s: 30,
    },
    ...overrides,
  };
}

export const minimalRehearsal: RehearsalDocument = {
  schema_version: "1.0",
  candidate_id: "minimal",
  forecast_id: "forecast-minimal",
  traffic_profile: { pattern: "constant", duration_s: 15, target_endpoint: "http://example" },
  failure: { type: "instance_stop", target_component: "web-1", injected_at_s: 0, duration_s: 0 },
  phases: {
    baseline: { duration_s: 5 },
    failure: { duration_s: 5 },
    recovery: { duration_s: 5 },
  },
  verdict: { passed: true, forecast_min_availability_pct: 99, measured_availability_pct: 100 },
  timestamps: {
    started_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-01T00:00:15Z",
  },
};

export const noFailureRehearsal = makeRehearsal({
  failure: { type: "instance_stop", target_component: "", injected_at_s: 0, duration_s: 0 },
});

export const missingMetricsRehearsal = makeRehearsal({
  phases: {
    baseline: { duration_s: 5 },
    failure: { duration_s: 5 },
    recovery: { duration_s: 5 },
  },
  component_results: [],
});

export const unsupportedSchemaRehearsal = makeRehearsal({ schema_version: "2.0" });

export const unknownVocabularyRehearsal = makeRehearsal({
  traffic_profile: {
    pattern: "wobble",
    duration_s: 20,
    target_endpoint: "http://example",
  },
  failure: {
    type: "meteor",
    target_component: "web-1",
    injected_at_s: 5,
    duration_s: 5,
  },
  component_results: [
    makeComponent({ component_id: "web-1", status: "on_fire", availability_pct: undefined }),
    makeComponent({ component_id: "web-2", status: "healthy" }),
  ],
  verdict: {
    passed: false,
    forecast_min_availability_pct: 99,
    measured_availability_pct: 90,
    reason: "Unknown failure type",
  },
  x_decision: { kind: "rethink", reason: "Unknown decision" },
  x_measurement_notes: ["Synthetic values"],
});

export const decisionConflictRehearsal = makeRehearsal({
  verdict: {
    passed: false,
    forecast_min_availability_pct: 99.9,
    measured_availability_pct: 90,
    gap_pct: -9.9,
    reason: "Availability fell short",
  },
  x_decision: { kind: "proceed", reason: "The recorded decision disagrees" },
});
