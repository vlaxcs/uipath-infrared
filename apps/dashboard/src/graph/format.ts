import type { SeriesMetric, StaticMetric } from "~/graph/types";

const UNIT_SUFFIX: Record<string, string> = {
  percent: "%",
  gb: "GB",
  count: "",
  ms: "ms",
  iops: "IOPS",
  messages: "messages",
};

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "Unknown";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatScalar).join(", ");
  return JSON.stringify(value);
}

export function formatMetric(metric: StaticMetric): string {
  return withUnit(formatNumber(metric.value), metric.unit);
}

export function formatSeries(metric: SeriesMetric): string {
  const parts: string[] = [];
  if (metric.avg !== undefined) parts.push(`avg ${withUnit(formatNumber(metric.avg), metric.unit)}`);
  if (metric.p95 !== undefined) parts.push(`p95 ${withUnit(formatNumber(metric.p95), metric.unit)}`);
  if (metric.max !== undefined) parts.push(`max ${withUnit(formatNumber(metric.max), metric.unit)}`);

  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

export function humanizeKey(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function withUnit(value: string, unit?: string | null): string {
  if (!unit) return value;
  const suffix = UNIT_SUFFIX[unit] ?? unit;
  if (!suffix) return value;
  return suffix === "%" ? `${value}%` : `${value} ${suffix}`;
}
