import type { LayoutOption, RunEvent, RunStep } from "~/runs/types";

export function layoutOptions(events: readonly RunEvent[]): LayoutOption[] {
  const gate = [...events]
    .sort((a, b) => b.seq - a.seq)
    .find((event) => event.status === "awaiting_approval" && event.gate === "layout");
  return gate?.x_candidates ?? [];
}

export function feasibleLayouts(options: readonly LayoutOption[]): LayoutOption[] {
  return options
    .filter((option) => option.feasible)
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}

export function latestRevisionFor(events: readonly RunEvent[], step: RunStep): number | null {
  const revisions = events.filter((event) => event.step === step).map((event) => event.revision);
  return revisions.length > 0 ? Math.max(...revisions) : null;
}

export function layoutOptionsFromResult(value: unknown): LayoutOption[] {
  if (!isRecord(value) || !Array.isArray(value.candidates)) return [];

  const options: LayoutOption[] = [];
  for (const candidate of value.candidates) {
    if (!isRecord(candidate) || typeof candidate.id !== "string") continue;
    const cost = isRecord(candidate.cost) ? candidate.cost : {};
    const option: LayoutOption = {
      id: candidate.id,
      feasible: candidate.feasible === true,
    };
    const rank = candidate.rank;
    const monthly = candidate.monthly_eur ?? cost.run_eur_month_now;
    const availability = candidate.availability_pct;
    const risk = candidate.risk;
    if (typeof rank === "number") option.rank = rank;
    if (typeof monthly === "number") option.monthly_eur = monthly;
    if (typeof availability === "number") option.availability_pct = availability;
    if (typeof risk === "number") option.risk = risk;
    options.push(option);
  }
  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
