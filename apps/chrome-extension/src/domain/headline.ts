import type { LatestRun } from "~/domain/types";

export type Headline =
  | { kind: "saving"; amount: number; percent: number | null; before: number; after: number }
  | { kind: "no-saving"; before: number; after: number }
  | { kind: "current"; before: number }
  | { kind: "unpriced" };

export function headlineOf(run: Pick<LatestRun, "before" | "after">): Headline {
  const { before, after } = run;
  if (before === null) return { kind: "unpriced" };
  if (after === null) return { kind: "current", before };

  const amount = before - after;
  if (amount <= 0) return { kind: "no-saving", before, after };

  return {
    kind: "saving",
    amount,
    percent: before > 0 ? Math.round((amount / before) * 100) : null,
    before,
    after,
  };
}

export type PrimaryAction = { label: string; emphasis: "primary" | "secondary" };

export function primaryActionOf(run: Pick<LatestRun, "status" | "awaiting">): PrimaryAction {
  if (run.status === "awaiting_approval") {
    return { label: run.awaiting === "plan" ? "Review plan" : "Review layout", emphasis: "primary" };
  }
  if (run.status === "failed") return { label: "See what failed", emphasis: "secondary" };
  return { label: "Open dashboard", emphasis: "secondary" };
}
