import { describe, expect, it } from "vitest";
import { edgeCaseContract } from "~/graph/fixtures";
import { buildGraphModel } from "~/graph/model";
import {
  CATEGORY_LABEL,
  CATEGORY_SHAPE,
  EDGE_STYLE,
  STACK_FILL_CLASSES,
  STATUS_META,
  shapePath,
  stackClasses,
  truncateLabel,
} from "~/graph/style";
import type { GraphCategory } from "~/graph/types";

describe("the graph styles", () => {
  it("gives every category a shape and label", () => {
    for (const category of Object.keys(CATEGORY_SHAPE) as GraphCategory[]) {
      expect(CATEGORY_LABEL[category]).toBeTruthy();
      const path = shapePath(CATEGORY_SHAPE[category], 10);
      expect(path.startsWith("M ")).toBe(true);
      expect(path).not.toContain("NaN");
    }
  });

  it("cycles the stack classes", () => {
    const classes = stackClasses(buildGraphModel(edgeCaseContract));

    expect([...classes.keys()]).toEqual(["main", "missing", "unassigned"]);
    expect(classes.get("main")?.fill).toBe("fill-graph-stack-1");
    expect(classes.get("missing")?.fill).toBe("fill-graph-stack-2");
    expect(classes.get("unassigned")?.fill).toBe("fill-graph-stack-3");
    expect(STACK_FILL_CLASSES).toHaveLength(5);
  });

  it("styles every edge kind and status", () => {
    for (const kind of Object.keys(EDGE_STYLE) as (keyof typeof EDGE_STYLE)[]) {
      expect(EDGE_STYLE[kind].label).toBeTruthy();
    }

    expect(STATUS_META.idle.haloClass).toBe("stroke-status-idle");
    expect(STATUS_META.orphan.haloClass).toBe("stroke-status-orphan");
    expect(STATUS_META.active.haloClass).toBeUndefined();
  });

  it("truncates long labels", () => {
    expect(truncateLabel("short")).toBe("short");
    expect(truncateLabel("x".repeat(40))).toHaveLength(26);
  });
});
