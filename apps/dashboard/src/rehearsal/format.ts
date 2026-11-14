import type { Metric } from "~/rehearsal/types";

function numberFormat(maxFractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: maxFractionDigits });
}

export function formatDecimal(value: number, maxFractionDigits = 2): string {
  return numberFormat(maxFractionDigits).format(value);
}

export function formatPercent(value: number | null | undefined, maxFractionDigits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not measured";
  return `${formatDecimal(value, maxFractionDigits)}%`;
}

export function formatSignedPp(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not stated";
  if (value === 0) return "0 pp";
  return `${value > 0 ? "+" : "-"}${formatDecimal(Math.abs(value), 3)} pp`;
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not recorded";
  return `${formatDecimal(value, 2)} s`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not recorded";
  return formatDecimal(value, 0);
}

export function humanizeKey(key: string): string {
  const words = key.replace(/[._-]+/g, " ").trim();
  if (words.length === 0) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const TIMESTAMP = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Not stated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not stated";
  return `${TIMESTAMP.format(date)} UTC`;
}

export type MetricKind = "percent" | "latency" | "generic";

export function formatMetricValue(metric: Metric | undefined, kind: MetricKind): string {
  if (!metric || !Number.isFinite(metric.value)) return "Not measured";
  if (kind === "percent") return formatPercent(metric.value);
  if (kind === "latency") return `${formatDecimal(metric.value, 2)} ${metric.unit ?? "ms"}`;
  const unit = metric.unit ? ` ${metric.unit}` : "";
  return `${formatDecimal(metric.value, 2)}${unit}`;
}
