const WHOLE_EUR = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const CENTS_EUR = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function decimal(value: number, maxFractionDigits: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatDecimal(value: number, maxFractionDigits = 2): string {
  return decimal(value, maxFractionDigits);
}

export function formatEur(value: number, precision: "whole" | "cents" = "whole"): string {
  const formatted = precision === "cents" ? CENTS_EUR.format(value) : WHOLE_EUR.format(value);
  return `EUR ${formatted}`;
}

export function formatSignedEur(value: number, precision: "whole" | "cents" = "whole"): string {
  if (value === 0) return formatEur(0, precision);
  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatEur(Math.abs(value), precision)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not known";
  return `${decimal(value, 3)}%`;
}

export function formatDeltaPp(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${decimal(Math.abs(value), 2)} pp`;
}

export function formatRisk(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not known";
  return decimal(value, 2);
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not scored";
  return decimal(value, 3);
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not known";
  return `${decimal(value, 2)} h`;
}

export function formatMonths(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not known";
  if (value === 1) return "1 month";
  return `${decimal(value, 1)} months`;
}

export function formatRank(value: number | null | undefined): string {
  if (value === null || value === undefined) return "No rank";
  return `#${value}`;
}

export function formatDistance(value: number): string {
  return decimal(value, 3);
}

export function formatSaving(value: number): string {
  const precision = Number.isInteger(value) ? "whole" : "cents";
  if (value > 0) return `Saves ${formatEur(value, precision)}/month`;
  if (value < 0) return `Adds ${formatEur(Math.abs(value), precision)}/month`;
  return "No run-cost change";
}

const MONEY_CONSTRAINTS = /budget$/;
const CONSTRAINT_UNITS: Record<string, string> = {
  min_availability_pct: "%",
  max_migration_effort_hours: " h",
  max_cutover_downtime_hours: " h",
};

export function formatConstraintValue(constraint: string, value: number | string | null): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (MONEY_CONSTRAINTS.test(constraint)) return formatEur(value);
  return `${decimal(value, 3)}${CONSTRAINT_UNITS[constraint] ?? ""}`;
}

export function humanizeKey(key: string): string {
  const words = key.replace(/[._-]+/g, " ").trim();
  if (words.length === 0) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
