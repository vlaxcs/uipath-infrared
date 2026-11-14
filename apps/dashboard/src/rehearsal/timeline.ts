import { formatSeconds } from "~/rehearsal/format";
import { phaseLabel } from "~/rehearsal/labels";
import { metricCell, requestsCell, type MetricCellView } from "~/rehearsal/metrics";
import type { PhaseKey, PhaseMeasurement, RehearsalDocument } from "~/rehearsal/types";

const PHASE_ORDER: readonly PhaseKey[] = ["baseline", "failure", "recovery"];

export type PhaseView = {
  key: PhaseKey;
  label: string;
  start: number;
  end: number;
  window: string;
  duration: string;
  availability: MetricCellView;
  errorRate: MetricCellView;
  latencyP50: MetricCellView;
  latencyP95: MetricCellView;
  latencyP99: MetricCellView;
  requests: string;
  requestsMeasured: boolean;
};

export type TimelineView = {
  phases: PhaseView[];
  totalDuration: number;
  failureWindow: string | null;
  measuredPhases: number;
};

function validDuration(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function window(start: number, end: number): string {
  return `${formatSeconds(start)} – ${formatSeconds(end)}`;
}

function phaseView(key: PhaseKey, phase: PhaseMeasurement | undefined, start: number): PhaseView {
  const duration = validDuration(phase?.duration_s) ? phase.duration_s : 0;
  const requests = requestsCell(phase);
  return {
    key,
    label: phaseLabel(key),
    start,
    end: start + duration,
    window: window(start, start + duration),
    duration: validDuration(phase?.duration_s) ? formatSeconds(phase.duration_s) : "Not recorded",
    availability: metricCell(phase?.availability_pct, "percent"),
    errorRate: metricCell(phase?.error_rate_pct, "percent"),
    latencyP50: metricCell(phase?.latency_p50_ms, "latency"),
    latencyP95: metricCell(phase?.latency_p95_ms, "latency"),
    latencyP99: metricCell(phase?.latency_p99_ms, "latency"),
    requests: requests.value,
    requestsMeasured: requests.measured,
  };
}

export function buildTimeline(rehearsal: RehearsalDocument): TimelineView {
  let offset = 0;
  const phases = PHASE_ORDER.map((key) => {
    const view = phaseView(key, rehearsal.phases[key], offset);
    offset = view.end;
    return view;
  });

  const target = rehearsal.failure?.target_component?.trim() ?? "";
  const injected = rehearsal.failure?.injected_at_s;
  const lasted = rehearsal.failure?.duration_s;
  const failureWindow =
    target && validDuration(injected) && validDuration(lasted)
      ? window(injected, injected + lasted)
      : null;

  const measuredPhases = phases.filter(
    (phase) =>
      phase.availability.measured ||
      phase.errorRate.measured ||
      phase.latencyP50.measured ||
      phase.latencyP95.measured ||
      phase.latencyP99.measured ||
      phase.requestsMeasured,
  ).length;

  return { phases, totalDuration: offset, failureWindow, measuredPhases };
}
