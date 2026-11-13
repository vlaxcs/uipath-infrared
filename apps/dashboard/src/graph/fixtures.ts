import type { InfraContract } from "~/graph/types";

export const edgeCaseContract: InfraContract = {
  project: "fixture",
  schema_version: "1.0",
  stacks: [
    { id: "main", name: "Main" },
    { id: "unused", name: "Unused" },
  ],
  components: [
    { id: "a", kind: "virtual_machine", stack: "main" },
    { id: "b", kind: "postgres", stack: "main", status: "idle", name: "  " },
    { id: "c", kind: "queue", stack: "missing", status: "orphan", name: "Queue C" },
    { id: "parent", kind: "kubernetes_cluster", status: "strange" },
    { id: "child", kind: "node_group", stack: "main", parent: "parent" },
  ],
  edges: [
    { from: "a", to: "b", kind: "data" },
    { from: "a", to: "b", kind: "data" },
    { from: "a", to: "a", kind: "data" },
    { from: "a", to: "ghost", kind: "data" },
    { from: "a", to: "c", kind: "event", gb_month: { value: 2, unit: "GB" } },
  ],
};

export function largeContract(count = 60): InfraContract {
  const components = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    kind: "virtual_machine",
    stack: "bulk",
  }));
  const edges = Array.from({ length: count - 1 }, (_, index) => ({
    from: `node-${index}`,
    to: `node-${index + 1}`,
    kind: "data",
  }));

  return {
    project: "large",
    stacks: [{ id: "bulk", name: "Bulk" }],
    components,
    edges,
  };
}
