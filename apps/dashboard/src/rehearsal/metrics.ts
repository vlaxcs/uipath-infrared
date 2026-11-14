import { formatCount, formatMetricValue, type MetricKind } from "~/rehearsal/format";
import { provenanceLabel } from "~/rehearsal/labels";
import type { Metric, PhaseMeasurement } from "~/rehearsal/types";

export type MetricCellView = {
  value: string;
  measured: boolean;
  provenance: string | null;
  basis: string | null;
};

export function metricCell(metric: Metric | undefined, kind: MetricKind): MetricCellView {
  const measured = metric !== undefined && Number.isFinite(metric.value);
  return {
    value: measured ? formatMetricValue(metric, kind) : "Not measured",
    measured,
    provenance: measured && metric ? provenanceLabel(metric.provenance) : null,
    basis: measured && metric?.basis ? metric.basis : null,
  };
}

export function requestsCell(phase: PhaseMeasurement | undefined): {
  value: string;
  measured: boolean;
} {
  if (!phase) return { value: "Not recorded", measured: false };
  const parts: string[] = [];
  if (phase.requests_total !== undefined) {
    parts.push(`${formatCount(phase.requests_total)} total`);
  }
  if (phase.requests_successful !== undefined) {
    parts.push(`${formatCount(phase.requests_successful)} succeeded`);
  }
  if (phase.requests_failed !== undefined) {
    parts.push(`${formatCount(phase.requests_failed)} failed`);
  }
  if (parts.length === 0) return { value: "Not recorded", measured: false };
  return { value: parts.join(" · "), measured: true };
}
