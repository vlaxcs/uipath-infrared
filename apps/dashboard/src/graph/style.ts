import type { EdgeKind, GraphCategory, GraphModel, GraphStatus } from "~/graph/types";
import type { StatusTone } from "~/ui/StatusBadge";

export type Shape = "circle" | "square" | "diamond" | "hexagon" | "triangle" | "pentagon";
export type FocusState = "normal" | "dim" | "focus";

export const CATEGORY_LABEL: Record<GraphCategory, string> = {
  compute: "Compute",
  data: "Data",
  storage: "Storage",
  messaging: "Messaging",
  network: "Network",
  edge: "Edge",
  other: "Other",
};

export const CATEGORY_SHAPE: Record<GraphCategory, Shape> = {
  compute: "circle",
  data: "square",
  storage: "square",
  messaging: "hexagon",
  network: "diamond",
  edge: "triangle",
  other: "pentagon",
};

export const STACK_FILL_CLASSES: readonly string[] = [
  "fill-graph-stack-1",
  "fill-graph-stack-2",
  "fill-graph-stack-3",
  "fill-graph-stack-4",
  "fill-graph-stack-5",
];

export const STACK_SWATCH_CLASSES: readonly string[] = [
  "bg-graph-stack-1",
  "bg-graph-stack-2",
  "bg-graph-stack-3",
  "bg-graph-stack-4",
  "bg-graph-stack-5",
];

export const EDGE_STYLE: Record<EdgeKind, { label: string; width: number; dash?: string; arrow: boolean }> = {
  network: { label: "Network", width: 1, arrow: false },
  data: { label: "Data", width: 1.8, arrow: true },
  event: { label: "Event", width: 1.6, dash: "6 4", arrow: true },
  traffic: { label: "Traffic", width: 2.4, arrow: true },
  dns: { label: "DNS", width: 1.6, dash: "2 4", arrow: true },
  config: { label: "Config", width: 1.2, dash: "1 5", arrow: true },
  contains: { label: "Contains", width: 1, arrow: false },
  other: { label: "Other", width: 1, arrow: true },
};

export const STATUS_META: Record<GraphStatus, { label: string; tone: StatusTone; haloClass?: string }> = {
  active: { label: "Active", tone: "neutral" },
  idle: { label: "Idle", tone: "idle", haloClass: "stroke-status-idle" },
  orphan: { label: "Orphan", tone: "orphan", haloClass: "stroke-status-orphan" },
  unknown: { label: "Unknown", tone: "neutral" },
};

export const NODE_STATE_CLASS: Record<FocusState, string> = {
  normal: "opacity-100",
  focus: "opacity-100",
  dim: "opacity-20",
};

export const EDGE_STATE_CLASS: Record<FocusState, string> = {
  normal: "stroke-graph-edge opacity-40",
  focus: "stroke-accent opacity-100",
  dim: "stroke-graph-edge opacity-10",
};

export function stackClasses(model: GraphModel): ReadonlyMap<string, { fill: string; swatch: string }> {
  const classes = new Map<string, { fill: string; swatch: string }>();

  model.stacks.forEach((stack, index) => {
    const slot = index % STACK_FILL_CLASSES.length;
    classes.set(stack.id, { fill: STACK_FILL_CLASSES[slot], swatch: STACK_SWATCH_CLASSES[slot] });
  });

  return classes;
}

export function shapePath(shape: Shape, radius: number): string {
  switch (shape) {
    case "circle":
      return `M ${radius} 0 A ${radius} ${radius} 0 1 1 ${-radius} 0 A ${radius} ${radius} 0 1 1 ${radius} 0 Z`;
    case "square":
      return `M ${-radius} ${-radius} H ${radius} V ${radius} H ${-radius} Z`;
    case "diamond":
      return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
    case "hexagon":
      return polygonPath(radius, 6, -Math.PI / 2);
    case "triangle":
      return polygonPath(radius, 3, -Math.PI / 2);
    case "pentagon":
      return polygonPath(radius, 5, -Math.PI / 2);
  }
}

export function truncateLabel(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function polygonPath(radius: number, sides: number, startAngle: number): string {
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + (index * 2 * Math.PI) / sides;
    return `${radius * Math.cos(angle)} ${radius * Math.sin(angle)}`;
  });

  return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}
