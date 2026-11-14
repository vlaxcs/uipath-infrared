import type { StepVisit } from "~/insights/types";
import type { RunStatus } from "~/runs/types";

// Projects keep their hue by position in the sorted project list, so a filter never repaints them.
const PROJECT_TONES = [
  { fill: "fill-graph-stack-1", stroke: "stroke-graph-stack-1", text: "text-graph-stack-1", bg: "bg-graph-stack-1" },
  { fill: "fill-graph-stack-2", stroke: "stroke-graph-stack-2", text: "text-graph-stack-2", bg: "bg-graph-stack-2" },
  { fill: "fill-graph-stack-3", stroke: "stroke-graph-stack-3", text: "text-graph-stack-3", bg: "bg-graph-stack-3" },
  { fill: "fill-graph-stack-4", stroke: "stroke-graph-stack-4", text: "text-graph-stack-4", bg: "bg-graph-stack-4" },
  { fill: "fill-graph-stack-5", stroke: "stroke-graph-stack-5", text: "text-graph-stack-5", bg: "bg-graph-stack-5" },
] as const;

export type ProjectTone = (typeof PROJECT_TONES)[number];

export function projectTone(index: number): ProjectTone {
  return PROJECT_TONES[Math.min(index, PROJECT_TONES.length - 1)]!;
}

export const RUN_TONES: Record<RunStatus, { fill: string; stroke: string; text: string; label: string }> = {
  running: { fill: "fill-status-running", stroke: "stroke-status-running", text: "text-status-running", label: "running" },
  awaiting_approval: { fill: "fill-status-awaiting", stroke: "stroke-status-awaiting", text: "text-status-awaiting", label: "waiting" },
  completed: { fill: "fill-status-completed", stroke: "stroke-status-completed", text: "text-status-completed", label: "done" },
  failed: { fill: "fill-status-failed", stroke: "stroke-status-failed", text: "text-status-failed", label: "stopped" },
};

export const VISIT_TONES: Record<StepVisit["state"], string> = {
  done: "fill-fg stroke-canvas",
  current: "fill-status-running stroke-canvas",
  awaiting: "fill-status-awaiting stroke-canvas",
  failed: "fill-status-failed stroke-canvas",
};

export function deltaTone(delta: number): string {
  return delta <= 0 ? "text-status-completed" : "text-status-awaiting";
}

export function deltaFill(delta: number): string {
  return delta <= 0 ? "fill-status-completed" : "fill-status-awaiting";
}
