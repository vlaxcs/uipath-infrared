import type { GraphModel, GraphNode } from "~/graph/types";

export const GRAPH_WIDTH = 1000;
export const GRAPH_HEIGHT = 700;
export const FIT_PADDING = 60;
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4;
export const LABEL_LIMIT = 30;

const TICKS = 260;
const EPSILON = 0.01;
const LABEL_MARGIN = 26;

export type Point = { x: number; y: number };
export type ViewTransform = { x: number; y: number; k: number };
export type PositionedNode = GraphNode & { x: number; y: number; r: number };

export function radiusFor(node: GraphNode): number {
  const bonus = (node.component.quantity ?? 1) > 1 ? 2 : 0;
  return 7 + Math.min(11, Math.sqrt(node.degree) * 2.2 + bonus);
}

export function stackAnchors(stackIds: readonly string[]): ReadonlyMap<string, Point> {
  const anchors = new Map<string, Point>();
  const count = stackIds.length;
  if (count === 0) return anchors;

  const centre = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  if (count === 1) {
    anchors.set(stackIds[0], centre);
    return anchors;
  }

  const radiusX = GRAPH_WIDTH * 0.28;
  const radiusY = GRAPH_HEIGHT * 0.28;

  stackIds.forEach((id, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    anchors.set(id, {
      x: centre.x + Math.cos(angle) * radiusX,
      y: centre.y + Math.sin(angle) * radiusY,
    });
  });

  return anchors;
}

export function layoutGraph(model: GraphModel, seed = 1): PositionedNode[] {
  const anchors = stackAnchors(model.stacks.map((stack) => stack.id));
  const random = mulberry32(seed);
  const centre = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };

  const nodes: PositionedNode[] = model.nodes.map((node) => {
    const anchor = anchors.get(node.stackId) ?? centre;
    return {
      ...node,
      x: anchor.x + (random() - 0.5) * 160,
      y: anchor.y + (random() - 0.5) * 160,
      r: radiusFor(node),
    };
  });
  if (nodes.length === 0) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = model.edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    return from && to ? [{ from, to, kind: edge.kind }] : [];
  });

  const velocities = nodes.map(() => ({ x: 0, y: 0 }));
  let alpha = 1;

  for (let tick = 0; tick < TICKS; tick++) {
    const forces = nodes.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);

        if (distance < EPSILON) {
          dx = EPSILON * (i - j + 1);
          dy = EPSILON;
          distance = Math.hypot(dx, dy);
        }

        const ux = dx / distance;
        const uy = dy / distance;
        const minDistance = a.r + b.r + 16;
        const repulsion = 2600 / (distance * distance);
        const collision = distance < minDistance ? (minDistance - distance) * 0.05 : 0;
        const push = repulsion + collision;

        forces[i].x -= ux * push;
        forces[i].y -= uy * push;
        forces[j].x += ux * push;
        forces[j].y += uy * push;
      }
    }

    for (const link of links) {
      let dx = link.to.x - link.from.x;
      let dy = link.to.y - link.from.y;
      let distance = Math.hypot(dx, dy);
      if (distance < EPSILON) distance = EPSILON;
      const ux = dx / distance;
      const uy = dy / distance;
      const length = link.kind === "network" ? 120 : link.kind === "contains" ? 46 : 90;
      const force = (distance - length) * 0.012 * alpha;

      const fromIndex = nodes.indexOf(link.from);
      const toIndex = nodes.indexOf(link.to);
      forces[fromIndex].x += ux * force;
      forces[fromIndex].y += uy * force;
      forces[toIndex].x -= ux * force;
      forces[toIndex].y -= uy * force;
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const anchor = anchors.get(node.stackId) ?? centre;
      forces[i].x += (anchor.x - node.x) * 0.0035 * alpha;
      forces[i].y += (anchor.y - node.y) * 0.0035 * alpha;

      velocities[i].x = (velocities[i].x + forces[i].x) * 0.82;
      velocities[i].y = (velocities[i].y + forces[i].y) * 0.82;
      node.x += velocities[i].x;
      node.y += velocities[i].y;
    }

    alpha *= 0.985;
  }

  for (const node of nodes) {
    const anchor = anchors.get(node.stackId) ?? centre;
    if (!Number.isFinite(node.x)) node.x = anchor.x;
    if (!Number.isFinite(node.y)) node.y = anchor.y;
    node.x = clamp(node.x, FIT_PADDING, GRAPH_WIDTH - FIT_PADDING);
    node.y = clamp(node.y, FIT_PADDING, GRAPH_HEIGHT - FIT_PADDING);
  }

  return nodes;
}

export function fitView(nodes: readonly PositionedNode[]): ViewTransform {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.r - LABEL_MARGIN);
    minY = Math.min(minY, node.y - node.r - LABEL_MARGIN);
    maxX = Math.max(maxX, node.x + node.r + LABEL_MARGIN);
    maxY = Math.max(maxY, node.y + node.r + LABEL_MARGIN);
  }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const k = clamp(Math.min(GRAPH_WIDTH / spanX, GRAPH_HEIGHT / spanY, 2.5), MIN_ZOOM, MAX_ZOOM);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  return {
    x: GRAPH_WIDTH / 2 - centreX * k,
    y: GRAPH_HEIGHT / 2 - centreY * k,
    k,
  };
}

export function panBy(view: ViewTransform, dx: number, dy: number): ViewTransform {
  return { x: view.x + dx, y: view.y + dy, k: view.k };
}

export function zoomAt(view: ViewTransform, factor: number, anchorX: number, anchorY: number): ViewTransform {
  const k = clamp(view.k * factor, MIN_ZOOM, MAX_ZOOM);
  return {
    x: anchorX - (anchorX - view.x) * (k / view.k),
    y: anchorY - (anchorY - view.y) * (k / view.k),
    k,
  };
}

export function edgePath(from: PositionedNode, to: PositionedNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPSILON) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  const ux = dx / distance;
  const uy = dy / distance;
  const startX = from.x + ux * (from.r + 1);
  const startY = from.y + uy * (from.r + 1);
  const endX = to.x - ux * (to.r + 3);
  const endY = to.y - uy * (to.r + 3);
  const controlX = (startX + endX) / 2 - uy * distance * 0.06;
  const controlY = (startY + endY) / 2 + ux * distance * 0.06;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
