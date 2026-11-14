import { describe, expect, it } from "vitest";
import {
  connectionsFor,
  defaultFilters,
  filterOptions,
  focusStates,
  toggleValue,
  visibleGraph,
} from "~/graph/filters";
import { largeContract } from "~/graph/fixtures";
import { buildGraphModel } from "~/graph/model";
import { sampleGraphModel } from "~/graph/sampleGraph";
import type { EdgeKind, GraphStatus } from "~/graph/types";

const filters = defaultFilters(sampleGraphModel);

describe("the graph filters", () => {
  it("starts with everything visible and labels on", () => {
    const visible = visibleGraph(sampleGraphModel, filters);

    expect(visible.nodes).toEqual(sampleGraphModel.nodes);
    expect(visible.edges).toEqual(sampleGraphModel.edges);
    expect(filters.showLabels).toBe(true);
    expect(defaultFilters(buildGraphModel(largeContract(60))).showLabels).toBe(false);
  });

  it("removes edges by kind", () => {
    const visible = visibleGraph(sampleGraphModel, {
      ...filters,
      kinds: new Set<EdgeKind>(["data", "network"]),
    });

    expect(visible.edges).toHaveLength(7);
  });

  it("removes nodes by status and their incident edges", () => {
    const visible = visibleGraph(sampleGraphModel, {
      ...filters,
      statuses: new Set<GraphStatus>(["active", "idle"]),
    });

    expect(visible.nodes).toHaveLength(9);
    expect(visible.nodes.some((node) => node.id === "logs-volume")).toBe(false);
  });

  it("removes all nodes when a stack is unchecked", () => {
    const visible = visibleGraph(sampleGraphModel, { ...filters, stacks: new Set<string>() });

    expect(visible.nodes).toHaveLength(0);
    expect(visible.edges).toHaveLength(0);
  });

  it("focuses a selected node and its neighbours", () => {
    const visible = visibleGraph(sampleGraphModel, filters);
    const states = focusStates(visible, { selectedId: "app-db", hoveredId: null, query: "" });

    expect(states.focusedId).toBe("app-db");
    expect(states.nodes["app-db"]).toBe("focus");
    expect(states.nodes["web-server"]).toBe("normal");
    expect(states.nodes["old-bastion"]).toBe("normal");
    expect(states.nodes["cache"]).toBe("dim");
    expect(states.edges["id:e01"]).toBe("focus");
    expect(states.edges["id:e02"]).toBe("dim");
  });

  it("lets selection win over hover", () => {
    const visible = visibleGraph(sampleGraphModel, filters);
    const states = focusStates(visible, { selectedId: "app-db", hoveredId: "cache", query: "" });

    expect(states.focusedId).toBe("app-db");
  });

  it("dims non-matches for a search, but selection focus wins", () => {
    const visible = visibleGraph(sampleGraphModel, filters);
    const search = focusStates(visible, { selectedId: null, hoveredId: null, query: "web" });

    expect(search.nodes["web-server"]).toBe("normal");
    expect(search.nodes["app-db"]).toBe("dim");
    expect(search.edges["id:e01"]).toBe("dim");

    const selected = focusStates(visible, { selectedId: "app-db", hoveredId: null, query: "web" });
    expect(selected.nodes["web-server"]).toBe("normal");
  });

  it("lists connections in both directions", () => {
    const visible = visibleGraph(sampleGraphModel, filters);

    expect(
      connectionsFor(visible, "app-db").inbound.map((connection) => connection.peer.id).sort(),
    ).toEqual(["old-bastion", "web-server", "worker"]);
    expect(connectionsFor(visible, "app-db").outbound).toHaveLength(0);
    expect(connectionsFor(visible, "web-server").outbound).toHaveLength(5);
    expect(connectionsFor(visible, "web-server").inbound).toHaveLength(0);
  });

  it("toggles set membership", () => {
    expect([...toggleValue(new Set(["a"]), "b")].sort()).toEqual(["a", "b"]);
    expect([...toggleValue(new Set(["a", "b"]), "a")]).toEqual(["b"]);
  });

  it("offers counts for each filter option", () => {
    const options = filterOptions(sampleGraphModel);

    expect(options.stacks).toEqual([{ id: "main", label: "Main application", count: 10 }]);
    expect(options.kinds.find((option) => option.kind === "data")?.count).toBe(5);
    expect(options.statuses.find((option) => option.status === "orphan")?.count).toBe(1);
  });
});
