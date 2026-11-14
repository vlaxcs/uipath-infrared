import type { RunSummary } from "~/runs/types";

const ACTIVE = new Set<RunSummary["status"]>(["running", "awaiting_approval"]);

export function holderOf(runs: readonly RunSummary[], project: string): RunSummary | null {
  return runs.find((run) => run.project === project && ACTIVE.has(run.status)) ?? null;
}

export function holdingReason(run: RunSummary): string {
  if (run.status === "awaiting_approval") {
    return run.awaiting === "plan" ? "waiting for the plan approval" : "waiting for the layout decision";
  }
  return `running ${run.step}`;
}

export function heldSince(run: RunSummary): string {
  const at = new Date(run.updated_at);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
