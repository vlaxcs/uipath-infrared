import { describe, expect, it } from "vitest";
import { makeAction } from "~/candidates/fixtures";
import { buildSteps } from "~/candidates/steps";

describe("building the change steps", () => {
  it("groups consecutive layers and numbers steps globally", () => {
    const steps = buildSteps([
      makeAction({ layer: "cleanup_orphans", action: "delete" }),
      makeAction({ layer: "cleanup_orphans", action: "stop" }),
      makeAction({ layer: "rightsize_in_place", action: "resize" }),
      makeAction({ layer: undefined, action: "flag" }),
      makeAction({ layer: "cleanup_orphans", action: "delete" }),
    ]);

    expect(steps.groups.map((group) => group.layer)).toEqual([
      "cleanup_orphans",
      "rightsize_in_place",
      undefined,
      "cleanup_orphans",
    ]);
    expect(steps.groups.map((group) => group.start)).toEqual([1, 3, 4, 5]);
    expect(steps.groups[0].steps.map((step) => step.number)).toEqual([1, 2]);
    expect(steps.total).toBe(5);
    expect(steps.changes).toBe(4);
    expect(steps.findings).toBe(1);
  });

  it("keeps duplicate components and identical actions", () => {
    const action = makeAction();
    const steps = buildSteps([action, { ...action }]);
    expect(steps.total).toBe(2);
    expect(steps.groups).toHaveLength(1);
    expect(steps.groups[0].steps).toHaveLength(2);
    expect(steps.groups[0].steps[0].number).toBe(1);
    expect(steps.groups[0].steps[1].number).toBe(2);
  });

  it("counts keeps and handles an empty change", () => {
    expect(buildSteps([makeAction({ action: "keep" })]).keeps).toBe(1);
    expect(buildSteps([])).toEqual({ groups: [], total: 0, changes: 0, findings: 0, keeps: 0 });
  });
});
