import type { Gate, RunStep, RunSummary } from "~/runs/types";

export type AwaitingRun = RunSummary & {
  status: "awaiting_approval";
  awaiting: Gate;
};

export function awaitingRuns(runs: readonly RunSummary[]): AwaitingRun[] {
  return runs
    .filter(
      (run): run is AwaitingRun =>
        run.status === "awaiting_approval" && (run.awaiting === "layout" || run.awaiting === "plan"),
    )
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

export function gateStep(gate: Gate | undefined): RunStep | null {
  if (gate === "layout") return "present";
  if (gate === "plan") return "rehearse";
  return null;
}
