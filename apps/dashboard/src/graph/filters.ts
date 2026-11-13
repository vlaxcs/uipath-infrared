import { LABEL_LIMIT } from "~/graph/layout";
import type { EdgeKind, GraphEdge, GraphModel, GraphNode, GraphStatus } from "~/graph/types";
import type { FocusState } from "~/graph/style";

export type Filters = {
  stacks: ReadonlySet<string>;
  kinds: ReadonlySet<EdgeKind>;
  statuses: ReadonlySet<GraphStatus>;
  query: string;
  showLabels: boolean;
};

export type FilterOptions = {
  stacks: { id: string; label: string; count: number }[];
  kinds: { kind: EdgeKind; count: number }[];
  statuses: { status: GraphStatus; count: number }[];
};

export type VisibleGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type FocusStates = {
  nodes: Record<string, FocusState>;
  edges: Record<string, FocusState>;
  focusedId: string | null;
};

export type Connection = {
  edge: GraphEdge;
  peer: GraphNode;
};

export type Connections = {
  outbound: Connection[];
  inbound: Connection[];
};

export function defaultFilters(model: GraphModel): Filters {
  return {
    stacks: new Set(model.stacks.map((stack) => stack.id)),
    kinds: new Set(model.edges.map((edge) => edge.kind)),
    statuses: new Set(model.nodes.map((node) => node.status)),
    query: "",
    showLabels: model.nodes.length <= LABEL_LIMIT,
  };
}

export function filterOptions(model: GraphModel): FilterOptions {
  const kinds = [...new Set(model.edges.map((edge) => edge.kind))].sort();
  const statuses = [...new Set(model.nodes.map((node) => node.status))].sort();

  return {
    stacks: model.stacks.map((stack) => ({ id: stack.id, label: stack.label, count: stack.count })),
    kinds: kinds.map((kind) => ({
      kind,
      count: model.edges.filter((edge) => edge.kind === kind).length,
    })),
    statuses: statuses.map((status) => ({
      status,
      count: model.nodes.filter((node) => node.status === status).length,
    })),
  };
}

export function toggleValue<T>(values: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function visibleGraph(model: GraphModel, filters: Filters): VisibleGraph {
  const nodes = model.nodes.filter(
    (node) => filters.stacks.has(node.stackId) && filters.statuses.has(node.status),
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = model.edges.filter(
    (edge) => filters.kinds.has(edge.kind) && nodeIds.has(edge.from) && nodeIds.has(edge.to),
  );

  return { nodes, edges };
}

export function focusStates(
  visible: VisibleGraph,
  input: { selectedId: string | null; hoveredId: string | null; query: string },
): FocusStates {
  const nodeIds = new Set(visible.nodes.map((node) => node.id));
  const focusedId =
    input.selectedId && nodeIds.has(input.selectedId)
      ? input.selectedId
      : input.hoveredId && nodeIds.has(input.hoveredId)
        ? input.hoveredId
        : null;
  const states: FocusStates = { nodes: {}, edges: {}, focusedId };

  if (focusedId) {
    const neighbours = new Set([focusedId]);
    for (const edge of visible.edges) {
      if (edge.from === focusedId) neighbours.add(edge.to);
      if (edge.to === focusedId) neighbours.add(edge.from);
    }
    for (const node of visible.nodes) {
      states.nodes[node.id] = node.id === focusedId ? "focus" : neighbours.has(node.id) ? "normal" : "dim";
    }
    for (const edge of visible.edges) {
      states.edges[edge.key] = edge.from === focusedId || edge.to === focusedId ? "focus" : "dim";
    }
    return states;
  }

  const query = input.query.trim().toLowerCase();
  if (!query) {
    for (const node of visible.nodes) states.nodes[node.id] = "normal";
    for (const edge of visible.edges) states.edges[edge.key] = "normal";
    return states;
  }

  const matches = new Set(
    visible.nodes.filter((node) => matchesQuery(node, query)).map((node) => node.id),
  );
  for (const node of visible.nodes) {
    states.nodes[node.id] = matches.has(node.id) ? "normal" : "dim";
  }
  for (const edge of visible.edges) {
    states.edges[edge.key] =
      matches.has(edge.from) && matches.has(edge.to) ? "normal" : "dim";
  }
  return states;
}

export function connectionsFor(visible: VisibleGraph, id: string | null): Connections {
  if (!id) return { outbound: [], inbound: [] };

  const byId = new Map(visible.nodes.map((node) => [node.id, node]));
  const outbound: Connection[] = [];
  const inbound: Connection[] = [];

  for (const edge of visible.edges) {
    if (edge.from === id) {
      const peer = byId.get(edge.to);
      if (peer) outbound.push({ edge, peer });
    }
    if (edge.to === id) {
      const peer = byId.get(edge.from);
      if (peer) inbound.push({ edge, peer });
    }
  }

  return { outbound, inbound };
}

function matchesQuery(node: GraphNode, query: string): boolean {
  return [node.id, node.label, node.kind, node.category, node.stackId, node.status]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
