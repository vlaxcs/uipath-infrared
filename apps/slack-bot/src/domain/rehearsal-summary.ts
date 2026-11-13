import type { RunEvent } from './run.js';

export interface LatencySummary {
  baselineP95?: number;
  failureP95?: number;
  recoveryP95?: number;
}

export interface RehearsalSummary {
  measuredAvailabilityPct?: number;
  targetAvailabilityPct?: number;
  passed?: boolean;
  gapPct?: number;
  failure?: string;
  latency?: LatencySummary;
}

export function rehearsalOf(event: RunEvent | undefined): RehearsalSummary | undefined {
  if (!event) return undefined;
  const raw = (event as RunEvent & { x_rehearsal?: unknown }).x_rehearsal;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const summary: RehearsalSummary = {};
  if (typeof source.measured_availability_pct === 'number') summary.measuredAvailabilityPct = source.measured_availability_pct;
  if (typeof source.target_availability_pct === 'number') summary.targetAvailabilityPct = source.target_availability_pct;
  if (typeof source.passed === 'boolean') summary.passed = source.passed;
  if (typeof source.gap_pct === 'number') summary.gapPct = source.gap_pct;
  if (typeof source.failure === 'string') summary.failure = source.failure;
  if (typeof source.latency_ms === 'object' && source.latency_ms !== null) {
    const latency = source.latency_ms as Record<string, unknown>;
    const parsed: LatencySummary = {};
    if (typeof latency.baseline_p95 === 'number') parsed.baselineP95 = latency.baseline_p95;
    if (typeof latency.failure_p95 === 'number') parsed.failureP95 = latency.failure_p95;
    if (typeof latency.recovery_p95 === 'number') parsed.recoveryP95 = latency.recovery_p95;
    if (Object.keys(parsed).length > 0) summary.latency = parsed;
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}
