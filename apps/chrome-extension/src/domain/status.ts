import type { Gate, RunStatus, RunStep, StepState } from "~/domain/types";

export type StatusTone = "running" | "awaiting" | "completed" | "failed" | "neutral";

type StatusMeta = {
  label: string;
  tone: StatusTone;
};

export const runStatusMeta: Record<RunStatus, StatusMeta> = {
  running: { label: "Running", tone: "running" },
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting" },
  completed: { label: "Completed", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
};

export const stepStateMeta: Record<StepState, StatusMeta> = {
  pending: { label: "Pending", tone: "neutral" },
  current: { label: "In progress", tone: "running" },
  awaiting: { label: "Awaiting approval", tone: "awaiting" },
  done: { label: "Done", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
};

export const gateMeta: Record<Gate, { label: string }> = {
  layout: { label: "Layout" },
  plan: { label: "Plan approval" },
};

export const STEP_LABELS: Record<RunStep, string> = {
  extract: "Extract",
  investigate: "Investigate",
  propose: "Propose",
  evaluate: "Evaluate",
  present: "Present",
  rehearse: "Rehearse",
};

export function runStatusLabel(run: { status: RunStatus; awaiting?: Gate }): string {
  if (run.status === "awaiting_approval" && run.awaiting) {
    return run.awaiting === "layout" ? "Awaiting layout" : "Awaiting plan";
  }
  return runStatusMeta[run.status].label;
}

export function stepLabel(step: RunStep): string {
  return STEP_LABELS[step];
}
