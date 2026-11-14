import { describe, expect, it } from "vitest";
import { largeContract } from "~/graph/fixtures";
import {
  FIT_PADDING,
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  edgePath,
  fitView,
  layoutGraph,
  panBy,
  stackAnchors,
  zoomAt,
} from "~/graph/layout";
import { buildGraphModel } from "~/graph/model";
import { sampleGraphModel } from "~/graph/sampleGraph";
import type { GraphModel } from "~/graph/types";

const positions = (model: GraphModel) =>
  layoutGraph(model, 42).map(({ id, x, y }) => ({ id, x, y }));

describe("the graph layout", () => {
  it("is deterministic for a seed", () => {
    expect(positions(sampleGraphModel)).toEqual(positions(sampleGraphModel));
  });

  it("keeps every node finite and inside the padded world", () => {
    for (const node of layoutGraph(sampleGraphModel, 7)) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(FIT_PADDING);
      expect(node.x).toBeLessThanOrEqual(GRAPH_WIDTH - FIT_PADDING);
      expect(node.y).toBeGreaterThanOrEqual(FIT_PADDING);
      expect(node.y).toBeLessThanOrEqual(GRAPH_HEIGHT - FIT_PADDING);
    }
  });

  it("does not mutate the model", () => {
    const before = sampleGraphModel.nodes.map((node) => ({ ...node }));
    layoutGraph(sampleGraphModel);
    expect(sampleGraphModel.nodes.map((node) => ({ ...node }))).toEqual(before);
  });

  it("uses the centre for one stack and distinct anchors for several", () => {
    expect(stackAnchors(["main"]).get("main")).toEqual({ x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 });

    const four = stackAnchors(["a", "b", "c", "d"]);
    expect(new Set([...four.values()].map((point) => `${point.x},${point.y}`)).size).toBe(4);
    expect(stackAnchors(["x", "y"]).get("x")).toEqual(stackAnchors(["renamed-x", "y"]).get("renamed-x"));
  });

  it("lays out 60 nodes without breaking", () => {
    const nodes = layoutGraph(buildGraphModel(largeContract(60)), 3);

    expect(nodes).toHaveLength(60);
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it("draws an edge between the node boundaries", () => {
    const nodes = layoutGraph(sampleGraphModel);
    const from = nodes.find((node) => node.id === "web-server")!;
    const to = nodes.find((node) => node.id === "app-db")!;
    const path = edgePath(from, to);

    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("Q");
    expect(path).not.toContain("NaN");
  });

  it("fits, pans and clamps zoom", () => {
    const nodes = layoutGraph(sampleGraphModel);
    const view = fitView(nodes);

    expect(view.k).toBeGreaterThan(0);
    expect(panBy(view, 10, -5)).toEqual({ x: view.x + 10, y: view.y - 5, k: view.k });
    expect(zoomAt(view, 100, 500, 350).k).toBe(MAX_ZOOM);
    expect(zoomAt(view, 0.001, 500, 350).k).toBe(MIN_ZOOM);
  });
});
