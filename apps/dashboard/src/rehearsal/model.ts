import { buildFallback, type FallbackView } from "~/rehearsal/fallback";
import {
  formatCount,
  formatDecimal,
  formatSeconds,
  formatTimestamp,
  humanizeKey,
} from "~/rehearsal/format";
import {
  componentStatusMeta,
  failureLabel,
  patternLabel,
  provenanceLabel,
  teardownMeta,
} from "~/rehearsal/labels";
import { metricCell, type MetricCellView } from "~/rehearsal/metrics";
import { buildTimeline, type TimelineView } from "~/rehearsal/timeline";
import type { ComponentResult, Metric, RehearsalDocument } from "~/rehearsal/types";
import { buildVerdict, type VerdictView } from "~/rehearsal/verdict";
import type { StatusTone } from "~/ui/StatusBadge";

export type ContextView = {
  candidateId: string;
  forecastId: string;
  schemaVersion: string;
  schemaSupported: boolean;
  startedAt: string;
  completedAt: string;
  elapsed: string | null;
  elapsedDerived: boolean;
  provenance: string;
};

export type TrafficView = {
  pattern: string;
  patternKey: string;
  duration: string;
  rate: string;
  endpoints: string[];
  totalRequests: string;
};

export type FailureView = {
  injected: boolean;
  type: string;
  target: string | null;
  injectedAt: string;
  duration: string;
  detail: string | null;
  headline: string;
};

export type ComponentRowView = {
  id: string;
  kind: string;
  statusLabel: string;
  statusTone: StatusTone;
  isFailureTarget: boolean;
  isLoadBalancer: boolean;
  availability: MetricCellView;
  cpu: MetricCellView;
  memory: MetricCellView;
  note: string | null;
};

export type InfrastructureView = {
  vpcId: string | null;
  namePrefix: string | null;
  endpoint: string | null;
  componentsCreated: string[];
  teardownLabel: string | null;
  teardownTone: StatusTone;
  remaining: string[];
  readiness: string | null;
};

export type SkippedView = {
  id: string;
  component: string;
  action: string;
  target: string | null;
  reason: string | null;
};

export type NotBuiltView = {
  id: string;
  component: string;
  kind: string;
  action: string;
  reason: string | null;
};

export type BuiltView = {
  id: string;
  kind: string;
  sku: string | null;
  zones: string | null;
  detail: string | null;
  resources: { id: string; type: string; name: string; zone: string | null }[];
};

export type ExtrasView = {
  skipped: SkippedView[];
  notBuilt: NotBuiltView[];
  built: BuiltView[];
};

export type RehearsalModel = {
  context: ContextView;
  verdict: VerdictView;
  traffic: TrafficView;
  failure: FailureView;
  timeline: TimelineView;
  components: ComponentRowView[];
  componentCounts: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    unknown: number;
  };
  fallback: FallbackView;
  caveats: string[];
  infrastructure: InfrastructureView | null;
  extras: ExtrasView;
};

function finiteNonNegative(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}

function collectProvenances(rehearsal: RehearsalDocument): string[] {
  const found = new Set<string>();
  const add = (metric: Metric | undefined) => {
    if (metric && Number.isFinite(metric.value)) found.add(metric.provenance);
  };
  for (const key of ["baseline", "failure", "recovery"] as const) {
    const phase = rehearsal.phases[key];
    add(phase?.availability_pct);
    add(phase?.error_rate_pct);
    add(phase?.latency_p50_ms);
    add(phase?.latency_p95_ms);
    add(phase?.latency_p99_ms);
  }
  for (const component of rehearsal.component_results ?? []) {
    add(component.availability_pct);
    add(component.cpu_pct);
    add(component.memory_pct);
  }
  return [...found];
}

function provenanceSummary(provenances: string[]): string {
  if (provenances.length === 0) return "No measurements recorded";
  if (provenances.length === 1) return `${provenanceLabel(provenances[0])} measurements`;
  return "Mixed measurement provenance";
}

function buildContext(rehearsal: RehearsalDocument): ContextView {
  const elapsedRecorded = finiteNonNegative(rehearsal.timestamps?.elapsed_s);
  let elapsed = elapsedRecorded !== null ? formatSeconds(elapsedRecorded) : null;
  let elapsedDerived = false;
  if (elapsed === null) {
    const started = Date.parse(rehearsal.timestamps?.started_at ?? "");
    const completed = Date.parse(rehearsal.timestamps?.completed_at ?? "");
    if (Number.isFinite(started) && Number.isFinite(completed) && completed >= started) {
      elapsed = formatSeconds((completed - started) / 1000);
      elapsedDerived = true;
    }
  }
  return {
    candidateId: rehearsal.candidate_id,
    forecastId: rehearsal.forecast_id,
    schemaVersion: rehearsal.schema_version,
    schemaSupported: /^1\.\d+$/.test(rehearsal.schema_version),
    startedAt: formatTimestamp(rehearsal.timestamps?.started_at),
    completedAt: formatTimestamp(rehearsal.timestamps?.completed_at),
    elapsed,
    elapsedDerived,
    provenance: provenanceSummary(collectProvenances(rehearsal)),
  };
}

function buildTraffic(rehearsal: RehearsalDocument): TrafficView {
  const traffic = rehearsal.traffic_profile;
  const rate: string[] = [];
  if (traffic.requests_per_second !== undefined) {
    rate.push(`${formatDecimal(traffic.requests_per_second, 2)} req/s`);
  }
  if (traffic.peak_requests_per_second !== undefined) {
    rate.push(`peak ${formatDecimal(traffic.peak_requests_per_second, 2)} req/s`);
  }
  return {
    pattern: patternLabel(traffic.pattern),
    patternKey: traffic.pattern,
    duration: formatSeconds(traffic.duration_s),
    rate: rate.length > 0 ? rate.join(" · ") : "Not stated",
    endpoints: traffic.target_endpoint
      .trim()
      .split(/\s+/)
      .filter(Boolean),
    totalRequests:
      traffic.total_requests !== undefined ? formatCount(traffic.total_requests) : "Not stated",
  };
}

function buildFailure(rehearsal: RehearsalDocument): FailureView {
  const failure = rehearsal.failure;
  const target = failure?.target_component?.trim() ?? "";
  if (!target) {
    return {
      injected: false,
      type: failureLabel(failure?.type ?? ""),
      target: null,
      injectedAt: "—",
      duration: "—",
      detail: null,
      headline: "No failure injected",
    };
  }
  const detail = failure.detail?.trim() ?? "";
  return {
    injected: true,
    type: failureLabel(failure.type),
    target,
    injectedAt: formatSeconds(failure.injected_at_s),
    duration: formatSeconds(failure.duration_s),
    detail: detail.length > 0 ? detail : null,
    headline: `${failureLabel(failure.type)} on ${target}`,
  };
}

function componentRank(component: ComponentResult, target: string): number {
  if (component.component_id === target) return 0;
  if (component.kind === "load_balancer") return 1;
  if (component.status === "failed") return 2;
  if (component.status === "degraded") return 3;
  return 4;
}

function buildComponents(rehearsal: RehearsalDocument, target: string) {
  const source = rehearsal.component_results ?? [];
  const rows = source
    .map((component, index) => ({ component, index }))
    .sort(
      (a, b) =>
        componentRank(a.component, target) - componentRank(b.component, target) ||
        a.index - b.index,
    )
    .map(({ component }) => {
      const status = componentStatusMeta(component.status);
      const note = component.note?.trim() ?? "";
      return {
        id: component.component_id,
        kind: humanizeKey(component.kind),
        statusLabel: status.label,
        statusTone: status.tone,
        isFailureTarget: component.component_id === target,
        isLoadBalancer: component.kind === "load_balancer",
        availability: metricCell(component.availability_pct, "percent"),
        cpu: metricCell(component.cpu_pct, "percent"),
        memory: metricCell(component.memory_pct, "percent"),
        note: note.length > 0 ? note : null,
      };
    });

  const counts = {
    total: rows.length,
    healthy: source.filter((component) => component.status === "healthy").length,
    degraded: source.filter((component) => component.status === "degraded").length,
    failed: source.filter((component) => component.status === "failed").length,
    unknown: source.filter(
      (component) => !["healthy", "degraded", "failed"].includes(component.status),
    ).length,
  };
  return { rows, counts };
}

function buildInfrastructure(
  rehearsal: RehearsalDocument,
): InfrastructureView | null {
  const infrastructure = rehearsal.infrastructure;
  const teardown = rehearsal.x_teardown;
  const readiness = rehearsal.x_readiness;
  if (!infrastructure && !teardown && !readiness) return null;

  const teardownStatus = infrastructure?.teardown_status;
  const teardownView = teardownStatus ? teardownMeta(teardownStatus) : null;
  const waited = finiteNonNegative(readiness?.waited_s);
  const readinessLabel =
    readiness?.ready === true
      ? waited !== null
        ? `Ready in ${formatSeconds(waited)}`
        : "Ready"
      : readiness?.ready === false
        ? "Not ready"
        : null;

  return {
    vpcId: infrastructure?.vpc_id ?? null,
    namePrefix: infrastructure?.name_prefix ?? null,
    endpoint: infrastructure?.endpoint ?? null,
    componentsCreated: infrastructure?.components_created ?? [],
    teardownLabel: teardownView?.label ?? null,
    teardownTone: teardownView?.tone ?? "neutral",
    remaining: teardown?.remaining ?? [],
    readiness: readinessLabel,
  };
}

function buildExtras(rehearsal: RehearsalDocument): ExtrasView {
  const skipped = (rehearsal.x_actions_skipped ?? []).map((action, index) => ({
    id: `${action.component}-${index}`,
    component: action.component,
    action: humanizeKey(action.action),
    target: action.to ?? null,
    reason: action.reason?.trim() || null,
  }));
  const notBuilt = (rehearsal.x_actions_not_built ?? []).map((action, index) => ({
    id: `${action.component_id}-${index}`,
    component: action.component_id,
    kind: humanizeKey(action.kind),
    action: humanizeKey(action.action),
    reason: action.reason?.trim() || null,
  }));
  const built = (rehearsal.x_components_built ?? []).map((component, index) => ({
    id: `${component.component_id}-${index}`,
    kind: humanizeKey(component.kind),
    sku: component.sku ?? null,
    zones: component.zones !== undefined ? `${component.zones}` : null,
    detail: component.detail ?? null,
    resources: (component.resources ?? []).map((resource, resourceIndex) => ({
      id: `${component.component_id}-${index}-${resourceIndex}`,
      type: humanizeKey(resource.type),
      name: resource.name,
      zone: resource.zone ?? null,
    })),
  }));
  return { skipped, notBuilt, built };
}

export function buildRehearsalModel(rehearsal: RehearsalDocument): RehearsalModel {
  const target = rehearsal.failure?.target_component?.trim() ?? "";
  const { rows, counts } = buildComponents(rehearsal, target);

  return {
    context: buildContext(rehearsal),
    verdict: buildVerdict(rehearsal),
    traffic: buildTraffic(rehearsal),
    failure: buildFailure(rehearsal),
    timeline: buildTimeline(rehearsal),
    components: rows,
    componentCounts: counts,
    fallback: buildFallback(rehearsal),
    caveats: (rehearsal.x_measurement_notes ?? [])
      .map((note) => note.trim())
      .filter((note) => note.length > 0),
    infrastructure: buildInfrastructure(rehearsal),
    extras: buildExtras(rehearsal),
  };
}
