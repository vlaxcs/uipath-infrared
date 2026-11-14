import type { ParallelTask } from "~/runs/parallelTasks";
import type { RunStep, StepState } from "~/runs/types";
import type { CheckOutcome, GateState, RunEnd, WorkflowFlow } from "~/runs/workflowFlow";

export type NodeKind = "terminal" | "step" | "check" | "gate" | "side" | "later";
export type NodeTone = "pending" | "current" | "awaiting" | "done" | "failed" | "later";
export type EdgeTone = "idle" | "taken" | "active" | "returned" | "later";

export type LayoutNode = {
  id: string;
  kind: NodeKind;
  label: string;
  sub: string;
  detail: string | null;
  tone: NodeTone;
  x: number;
  y: number;
  width: number;
  height: number;
  step?: RunStep;
  beside?: RunStep;
  candidate?: string;
};

export type LayoutEdge = { id: string; path: string; tone: EdgeTone; label: string | null; labelX: number; labelY: number; returns: boolean };
export type Frame = { label: string; sub: string; x: number; y: number; width: number; height: number; used: boolean };

export type WorkflowLayout = { width: number; height: number; nodes: LayoutNode[]; edges: LayoutEdge[]; loop: Frame; phaseTwo: Frame };

export const LAYOUT_WIDTH = 704;
const ROW = 58;
const TOP = 24;
const SIDE_WIDTH = 170;
const SIDE_GAP = 24;
const LEFT = 16 + SIDE_WIDTH + SIDE_GAP;
const WIDTH = 230;
const LANE = 74;
const FRAME_PAD = 9;
const HEIGHTS: Record<NodeKind, number> = { terminal: 34, step: 40, check: 34, gate: 36, side: 34, later: 34 };

const STEP_TONE: Record<StepState, NodeTone> = { pending: "pending", current: "current", awaiting: "awaiting", done: "done", failed: "failed" };
const CHECK_TONE: Record<CheckOutcome, NodeTone> = { pending: "pending", passed: "done", revised: "awaiting", stopped: "failed" };
const CHECK_SUB: Record<CheckOutcome, string> = { pending: "Not reached", passed: "Yes", revised: "No, revised", stopped: "No, stopped" };
const GATE_TONE: Record<GateState, NodeTone> = { pending: "pending", awaiting: "awaiting", decided: "done" };
const GATE_SUB: Record<GateState, string> = { pending: "Not reached", awaiting: "Waiting for a decision", decided: "Decided" };
const END_TONE: Record<RunEnd, NodeTone> = { running: "pending", completed: "done", failed: "failed" };
const STEP_SUB: Record<StepState, string> = { pending: "Pending", current: "In progress", awaiting: "Awaiting approval", done: "Done", failed: "Failed" };
const SIDE_TONE: Record<ParallelTask["state"], NodeTone> = { running: "current", done: "done", failed: "failed" };
const SIDE_SUB: Record<ParallelTask["state"], string> = { running: "Building", done: "Built", failed: "Not built" };

type Spine = { id: string; kind: NodeKind; label: string; sub: string; detail?: string | null; tone: NodeTone; step?: RunStep; edgeLabel?: string };

export function workflowLayout(
  flow: WorkflowFlow,
  project: string,
  titles: Record<RunStep, string>,
  states: Record<RunStep, StepState>,
  parallel: readonly ParallelTask[],
  trials: number,
): WorkflowLayout {
  const step = (id: RunStep): Spine => ({ id, kind: "step", label: `${titles[id]}`, sub: STEP_SUB[states[id]], tone: STEP_TONE[states[id]], step: id });
  const spine: Spine[] = [
    { id: "start", kind: "terminal", label: `Analyze: ${project}`, sub: "Started", tone: "done" },
    step("extract"),
    { id: "contract", kind: "check", label: flow.extractCheck.question, sub: CHECK_SUB[flow.extractCheck.outcome], detail: flow.extractCheck.reason, tone: CHECK_TONE[flow.extractCheck.outcome] },
    { ...step("investigate"), edgeLabel: "yes" },
    step("propose"),
    step("evaluate"),
    { id: "feasible", kind: "check", label: flow.evaluateCheck.question, sub: CHECK_SUB[flow.evaluateCheck.outcome], detail: flow.evaluateCheck.reason, tone: CHECK_TONE[flow.evaluateCheck.outcome] },
    { ...step("present"), edgeLabel: "yes" },
    { id: "layout-gate", kind: "gate", label: flow.layoutGate.label, sub: flow.layoutGate.detail ? `${GATE_SUB[flow.layoutGate.state]}: ${flow.layoutGate.detail}` : GATE_SUB[flow.layoutGate.state], tone: GATE_TONE[flow.layoutGate.state] },
    step("rehearse"),
    { id: "forecast", kind: "check", label: flow.rehearseCheck.question, sub: CHECK_SUB[flow.rehearseCheck.outcome], detail: flow.rehearseCheck.reason, tone: CHECK_TONE[flow.rehearseCheck.outcome] },
    { id: "plan-gate", kind: "gate", label: flow.planGate.label, sub: GATE_SUB[flow.planGate.state], tone: GATE_TONE[flow.planGate.state], edgeLabel: "yes" },
    {
      id: "end",
      kind: "terminal",
      label: flow.failure ? `Failed at ${titles[flow.failure.step]}` : flow.end === "completed" ? "Run completed" : "End",
      sub: flow.end === "completed" ? "Project released" : flow.end === "failed" ? "Run failed" : "Not finished",
      detail: flow.failure?.reason ?? null,
      tone: END_TONE[flow.end],
    },
    { id: "pr", kind: "later", label: "Open a pull request per step", sub: "Phase 2, not built", tone: "later" },
    { id: "review", kind: "later", label: "A person approves, CI applies", sub: "Phase 2, not built", tone: "later" },
    { id: "verify", kind: "later", label: "Verify against the forecast", sub: "Phase 2, not built", tone: "later" },
  ];

  const nodes: LayoutNode[] = spine.map((item, index) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    sub: item.sub,
    detail: item.detail ?? null,
    tone: item.tone,
    step: item.step,
    x: LEFT,
    y: TOP + index * ROW,
    width: WIDTH,
    height: HEIGHTS[item.kind],
  }));
  const at = (id: string) => nodes.find((node) => node.id === id)!;
  const middle = (node: LayoutNode) => node.y + node.height / 2;

  const edges: LayoutEdge[] = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    const later = to.kind === "later";
    const tone: EdgeTone = later ? "later" : to.tone === "done" || to.tone === "failed" ? "taken" : to.tone === "current" || to.tone === "awaiting" ? "active" : "idle";
    const x = from.x + from.width / 2;
    edges.push({
      id: `${from.id}-${to.id}`,
      path: `M ${x} ${from.y + from.height} V ${to.y}`,
      tone,
      label: spine[index].edgeLabel ?? null,
      labelX: x + 6,
      labelY: from.y + from.height + 12,
      returns: false,
    });
  }

  /* Return edges run up their own lane right of the spine. An outer lane
     enters Propose higher than the lanes inside it, so no two cross. */
  const right = LEFT + WIDTH;
  const propose = at("propose");
  const returnEdge = (id: string, fromId: string, lane: number, arrive: number, count: number, label: string, tone: EdgeTone): LayoutEdge => {
    const from = at(fromId);
    const x = right + lane * LANE - 40;
    return {
      id,
      path: `M ${from.x + from.width} ${middle(from)} H ${x} V ${middle(propose) + arrive} H ${propose.x + propose.width}`,
      tone: count > 0 ? tone : tone === "later" ? "later" : "idle",
      label: count > 0 ? `${label} x${count}` : label,
      labelX: x + 6,
      labelY: (middle(from) + middle(propose)) / 2,
      returns: true,
    };
  };
  edges.push(returnEdge("revise-evaluate", "feasible", 1, 10, flow.evaluateRevisions, "revise", "returned"));
  edges.push(returnEdge("revise-rehearse", "forecast", 2, 0, flow.rehearseRevisions, "revise", "returned"));
  edges.push(returnEdge("diverge", "verify", 3, -10, 0, "diverges", "later"));

  const sideOf = (parentId: string, id: string, label: string, sub: string, tone: NodeTone, beside: RunStep, candidate?: string): void => {
    const parent = at(parentId);
    const node: LayoutNode = { id, kind: "side", label, sub, detail: null, tone, x: parent.x - SIDE_WIDTH - SIDE_GAP, y: parent.y + (parent.height - HEIGHTS.side) / 2, width: SIDE_WIDTH, height: HEIGHTS.side, beside, candidate };
    nodes.push(node);
    edges.push({
      id: `${parentId}-${id}`,
      path: `M ${parent.x} ${middle(parent)} H ${node.x + node.width}`,
      tone: tone === "pending" ? "idle" : tone === "current" ? "active" : "taken",
      label: null,
      labelX: 0,
      labelY: 0,
      returns: false,
    });
  };
  const latestBeside = new Map<RunStep, ParallelTask>();
  for (const task of parallel) latestBeside.set(task.beside, task);
  for (const task of latestBeside.values()) {
    const parentId = task.beside === "present" ? "feasible" : "layout-gate";
    sideOf(parentId, task.id, task.label.replace("Migration plan · ", "Plan: "), SIDE_SUB[task.state], SIDE_TONE[task.state], task.beside, task.state === "done" ? task.candidate : undefined);
  }
  if (trials > 0) sideOf("rehearse", "trials", `Trials: ${trials}`, "Gates untouched", "done", "rehearse");

  const loopTop = propose.y - FRAME_PAD;
  const loopBottom = at("forecast").y + at("forecast").height + FRAME_PAD;
  const end = at("verify");
  const firstLater = at("pr");
  return {
    width: LAYOUT_WIDTH,
    height: end.y + end.height + 16,
    nodes,
    edges,
    loop: {
      label: "Revision loop",
      sub: `revision ${flow.revision} of ${flow.maxRevisions}`,
      x: 4,
      y: loopTop,
      width: right + 2 * LANE - 40 + 56,
      height: loopBottom - loopTop,
      used: flow.revisions > 0,
    },
    phaseTwo: {
      label: "Phase 2",
      sub: "not built yet",
      x: 4,
      y: firstLater.y - FRAME_PAD,
      width: right + FRAME_PAD,
      height: end.y + end.height - firstLater.y + 2 * FRAME_PAD,
      used: false,
    },
  };
}
