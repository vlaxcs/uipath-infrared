import type {
  DecisionKind,
  EventStatus,
  Gate,
  Run,
  RunActor,
  RunStatus,
  StepState,
} from "~/runs/types";
import type { StatusTone } from "~/ui/StatusBadge";

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

export const eventStatusMeta: Record<EventStatus, StatusMeta> = {
  started: { label: "Started", tone: "running" },
  completed: { label: "Completed", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
  awaiting_approval: { label: "Awaiting approval", tone: "awaiting" },
  approved: { label: "Approved", tone: "completed" },
};

export const decisionMeta: Record<DecisionKind, { label: string; tone: StatusTone }> = {
  proceed: { label: "Proceed", tone: "running" },
  revise: { label: "Revise", tone: "awaiting" },
  stop: { label: "Stop", tone: "failed" },
  keep_analyses: { label: "Keep analyses", tone: "completed" },
  pick_layout: { label: "Pick layout", tone: "completed" },
  approve_plan: { label: "Approve plan", tone: "completed" },
};

export const gateMeta: Record<Gate, { label: string; title: string; description: string }> = {
  layout: {
    label: "Layout",
    title: "A layout is waiting to be picked",
    description: "Keep analyses, then pick the layout to rehearse.",
  },
  plan: {
    label: "Plan approval",
    title: "The plan is waiting for approval",
    description: "The rehearsal held; approving the plan completes the run.",
  },
};

export const stepStateMeta: Record<StepState, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "neutral" },
  current: { label: "In progress", tone: "running" },
  awaiting: { label: "Awaiting approval", tone: "awaiting" },
  done: { label: "Done", tone: "completed" },
  failed: { label: "Failed", tone: "failed" },
};

export function runStatusLabel(run: Run): string {
  if (run.status === "awaiting_approval" && run.awaiting) {
    return run.awaiting === "layout" ? "Awaiting layout" : "Awaiting plan";
  }
  return runStatusMeta[run.status].label;
}

export function formatActor(actor: RunActor): string {
  return actor.kind === "orchestrator" ? "Orchestrator" : `${actor.id} (${actor.surface})`;
}
