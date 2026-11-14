import type {
  Action,
  Candidate,
  Cost,
  ResultDocument,
  Violation,
} from "~/candidates/types";

export function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    constraint: "min_availability_pct",
    component: "app-db",
    detail: "critical path reaches 97.9%",
    actual: 97.9,
    limit: 99.5,
    distance: 1.6,
    ...overrides,
  };
}

export function makeCost(overrides: Partial<Cost> = {}): Cost {
  return {
    run_eur_month_now: 1000,
    horizon_by_scenario: { low: 900, base: 1000, high: 1100 },
    horizon_run_eur: 24000,
    migration_eur: 1200,
    ops_eur_month: 100,
    expected_outage_loss_eur_year: 500,
    expected_total_eur: 30000,
    ...overrides,
  };
}

export function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    component: "app-db",
    action: "resize",
    layer: "rightsize_in_place",
    reason: "over-provisioned",
    from: "large",
    to: "medium",
    saving_eur_month: 100,
    confidence: "high",
    confidence_reason: "observed",
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "candidate",
    source: "engine",
    builds_on: null,
    feasible: true,
    violations: [],
    violation_distance: 0,
    actions: [],
    cost: makeCost(),
    availability_pct: 99.9,
    risk: 0.1,
    effort_hours: 10,
    payback_months: 2,
    score: 0.2,
    pareto: true,
    rank: 1,
    rank_by_scenario: { low: 1, base: 1, high: 2 },
    lost_because: null,
    confidence: "high",
    confidence_reason: "observed",
    flags: [],
    ...overrides,
  };
}

export function makeResult(overrides: Partial<ResultDocument> = {}): ResultDocument {
  return {
    schema_version: "1.0",
    inputs: {
      infra: "startup",
      forecast: "startup-plan",
      catalog_illustrative: true,
      horizon_months: 24,
      currency: "EUR",
    },
    baseline: { monthly_eur: 1200, availability_pct: 98, violations: [] },
    candidates: [makeCandidate()],
    winner: "candidate",
    closest_if_none_feasible: null,
    flags: [],
    ...overrides,
  };
}

export const emptyResult = makeResult({
  candidates: [],
  winner: null,
  closest_if_none_feasible: null,
});

export const unsupportedSchemaResult = makeResult({ schema_version: "2.0" });

export const nothingFeasibleFixture = makeResult({
  candidates: [
    makeCandidate({
      id: "almost",
      feasible: false,
      rank: null,
      score: null,
      pareto: false,
      violations: [makeViolation({ constraint: "budget", component: null, actual: 139450, limit: 90000 })],
      lost_because: { reason: "constraint", detail: "base scenario, month 36" },
    }),
  ],
  winner: null,
  closest_if_none_feasible: {
    candidate: "almost",
    violation_distance: 0.549,
    blocked_by: [makeViolation({ constraint: "budget", component: null, actual: 139450, limit: 90000 })],
  },
});

export const unknownVocabularyResult = makeResult({
  candidates: [
    makeCandidate({
      id: "strange",
      actions: [
        makeAction({ action: "teleport" as Action["action"], layer: "warp_drive", confidence: "certain" as Action["confidence"] }),
      ],
      lost_because: { reason: "vibes", detail: "unknown reason" } as unknown as Candidate["lost_because"],
      flags: ["brand_new_flag"],
    }),
    makeCandidate({
      id: "winner",
      source: "agent",
      rank: 2,
      actions: [makeAction()],
      flags: ["brand_new_flag"],
    }),
  ],
  winner: "winner",
  flags: ["brand_new_flag"],
});
