import { describe, expect, it } from "vitest";
import { edgeCaseContract, largeContract } from "~/graph/fixtures";
import { buildGraphModel, categoryOfKind, edgeKindOf, normalizeStatus } from "~/graph/model";
import { sampleGraphModel } from "~/graph/sampleGraph";

describe("building the graph model", () => {
  it("turns the start-up mock into 10 nodes and 9 edges", () => {
    expect(sampleGraphModel.project).toBe("startup");
    expect(sampleGraphModel.nodes).toHaveLength(10);
    expect(sampleGraphModel.edges).toHaveLength(9);
    expect(sampleGraphModel.stacks).toEqual([{ id: "main", label: "Main application", count: 10 }]);
  });

  it("maps component kinds to categories", () => {
    const byId = new Map(sampleGraphModel.nodes.map((node) => [node.id, node]));

    expect(byId.get("web-server")?.category).toBe("compute");
    expect(byId.get("app-db")?.category).toBe("data");
    expect(byId.get("queue")?.category).toBe("messaging");
    expect(byId.get("uploads")?.category).toBe("storage");
    expect(byId.get("nat")?.category).toBe("network");
    expect(categoryOfKind("mystery")).toBe("other");
  });

  it("computes degree from the surviving edges", () => {
    const byId = new Map(sampleGraphModel.nodes.map((node) => [node.id, node]));

    expect(byId.get("web-server")?.degree).toBe(5);
    expect(byId.get("app-db")?.degree).toBe(3);
    expect(byId.get("worker")?.degree).toBe(3);
    expect(byId.get("uploads")?.degree).toBe(2);
    expect(byId.get("logs-volume")?.degree).toBe(0);
  });

  it("keeps the start-up mock's connections", () => {
    const has = (from: string, to: string, kind: string) =>
      sampleGraphModel.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind);

    expect(has("web-server", "app-db", "data")).toBe(true);
    expect(has("web-server", "queue", "event")).toBe(true);
    expect(has("old-bastion", "app-db", "network")).toBe(true);
  });

  it("drops dangling and self edges and keeps parallel edges distinct", () => {
    const model = buildGraphModel(edgeCaseContract);

    expect(model.nodes).toHaveLength(5);
    expect(model.edges).toHaveLength(4);
    expect(model.edges.filter((edge) => edge.from === "a" && edge.to === "b")).toHaveLength(2);
    expect(new Set(model.edges.map((edge) => edge.key)).size).toBe(4);
    expect(
      model.edges.some((edge) => edge.kind === "contains" && edge.from === "parent" && edge.to === "child"),
    ).toBe(true);
  });

  it("falls back for missing names, stacks and statuses", () => {
    const byId = new Map(buildGraphModel(edgeCaseContract).nodes.map((node) => [node.id, node]));

    expect(byId.get("b")?.label).toBe("b");
    expect(byId.get("c")?.stackId).toBe("missing");
    expect(byId.get("c")?.status).toBe("orphan");
    expect(byId.get("parent")?.status).toBe("unknown");
    expect(byId.get("parent")?.stackId).toBe("unassigned");
    expect(normalizeStatus("weird")).toBe("unknown");
    expect(edgeKindOf("weird")).toBe("other");
  });

  it("builds a large model without throwing", () => {
    const model = buildGraphModel(largeContract(60));

    expect(model.nodes).toHaveLength(60);
    expect(model.edges).toHaveLength(59);
  });
});
