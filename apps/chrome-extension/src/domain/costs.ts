export type RunCost = {
  before: number | null;
  after: number | null;
  winner: string | null;
};

export function emptyCost(): RunCost {
  return { before: null, after: null, winner: null };
}

export function runCostFromResult(value: unknown): RunCost {
  if (!isRecord(value)) return emptyCost();

  const baseline =
    isRecord(value.baseline) && typeof value.baseline.monthly_eur === "number"
      ? value.baseline.monthly_eur
      : null;
  const winner = typeof value.winner === "string" ? value.winner : null;
  const candidate =
    winner && Array.isArray(value.candidates)
      ? value.candidates.find((item) => isRecord(item) && item.id === winner)
      : undefined;

  return { before: baseline, after: candidateCost(candidate), winner };
}

function candidateCost(candidate: unknown): number | null {
  if (!isRecord(candidate)) return null;
  if (isRecord(candidate.cost) && typeof candidate.cost.run_eur_month_now === "number") {
    return candidate.cost.run_eur_month_now;
  }
  return typeof candidate.monthly_eur === "number" ? candidate.monthly_eur : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
