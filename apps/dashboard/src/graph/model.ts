import type {
  EdgeKind,
  GraphCategory,
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphStack,
  GraphStatus,
  InfraComponent,
  InfraContract,
  InfraEdge,
} from "~/graph/types";

export const CATEGORY_BY_KIND: Readonly<Record<string, GraphCategory>> = {
  virtual_machine: "compute",
  function: "compute",
  container: "compute",
  kubernetes_cluster: "compute",
  node_group: "compute",
  postgres: "data",
  nosql: "data",
  cache: "data",
  queue: "messaging",
  stream: "messaging",
  object_storage: "storage",
  block_storage: "storage",
  file_system: "storage",
  load_balancer: "edge",
  cdn: "edge",
  dns: "edge",
  nat: "network",
};

const EDGE_KINDS: readonly EdgeKind[] = [
  "network",
  "data",
  "event",
  "traffic",
  "dns",
  "config",
  "contains",
  "other",
];

export function categoryOfKind(kind: string): GraphCategory {
  return CATEGORY_BY_KIND[kind] ?? "other";
}

export function normalizeStatus(status: unknown): GraphStatus {
  return status === "active" || status === "idle" || status === "orphan" ? status : "unknown";
}

export function edgeKindOf(kind: string): EdgeKind {
  return EDGE_KINDS.includes(kind as EdgeKind) ? (kind as EdgeKind) : "other";
}

export function edgeKey(edge: InfraEdge, index: number): string {
  return edge.id ? `id:${edge.id}` : `${edge.from}->${edge.to}:${edge.kind}:${index}`;
}

export function buildGraphModel(contract: InfraContract): GraphModel {
  const components = contract.components ?? [];
  const componentById = new Map<string, InfraComponent>();
  for (const component of components) {
    if (!componentById.has(component.id)) componentById.set(component.id, component);
  }

  const nodes: GraphNode[] = [...componentById.values()].map((component) => ({
    id: component.id,
    label: labelOf(component),
    kind: component.kind,
    category: categoryOfKind(component.kind),
    stackId: component.stack?.trim() || "unassigned",
    status: normalizeStatus(component.status),
    degree: 0,
    component,
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edges: GraphEdge[] = [];
  (contract.edges ?? []).forEach((edge, index) => {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to) || edge.from === edge.to) return;
    edges.push(toGraphEdge(edge, index));
  });

  for (const node of nodes) {
    const parent = node.component.parent;
    if (!parent || parent === node.id || !nodeById.has(parent)) continue;
    edges.push({
      key: `contains:${parent}->${node.id}`,
      from: parent,
      to: node.id,
      kind: "contains",
    });
  }

  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }
  for (const node of nodes) node.degree = degrees.get(node.id) ?? 0;

  return {
    project: contract.project,
    generatedAt: typeof contract.source?.generated_at === "string" ? contract.source.generated_at : undefined,
    isMock: contract.source?.is_mock === true,
    nodes,
    edges,
    stacks: buildStacks(contract, nodes),
  };
}

function labelOf(component: InfraComponent): string {
  return component.name?.trim() || component.id;
}

function toGraphEdge(edge: InfraEdge, index: number): GraphEdge {
  return {
    key: edgeKey(edge, index),
    from: edge.from,
    to: edge.to,
    kind: edgeKindOf(edge.kind),
    evidence: edge.evidence ?? undefined,
    gbMonth: edge.gb_month ?? undefined,
    latencySensitive: edge.latency_sensitive ?? undefined,
    note: edge.note ?? undefined,
  };
}

function buildStacks(contract: InfraContract, nodes: readonly GraphNode[]): GraphStack[] {
  const declared = contract.stacks ?? [];
  const usedIds = new Set(nodes.map((node) => node.stackId));
  const orderedIds = declared.filter((stack) => usedIds.has(stack.id)).map((stack) => stack.id);

  for (const id of usedIds) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  return orderedIds.map((id) => {
    const stack = declared.find((entry) => entry.id === id);
    return {
      id,
      label: stack?.name?.trim() || (id === "unassigned" ? "Unassigned" : id),
      count: nodes.filter((node) => node.stackId === id).length,
    };
  });
}
