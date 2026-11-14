import { describe, expect, it } from "vitest";
import { innerRadius, lanePath, orbRadius, placeOrbs, STAGES, stepX } from "~/insights/geometry";
import type { ProjectInsight, StepVisit } from "~/insights/types";

function projectOf(id: string, before: number | null, after: number | null): ProjectInsight {
  return { id, label: id, runs: [], settled: null, before, after, components: 0, findings: 0 };
}

function visit(step: StepVisit["step"], revision = 0): StepVisit {
  return { step, revision, start: 0, end: 0, state: "done" };
}

describe("orb sizes", () => {
  it("scales area with spend, between the two bounds", () => {
    expect(orbRadius(null, 100)).toBe(30);
    expect(orbRadius(100, 100)).toBe(92);
    expect(orbRadius(25, 100)).toBe(30 + 62 * 0.5);
  });

  it("draws the inner disc with the area of the cost after", () => {
    expect(innerRadius(100, 400, 100)).toBe(50);
    expect(innerRadius(100, 100, 400)).toBe(200);
    expect(innerRadius(100, null, 10)).toBe(0);
  });
});

describe("placeOrbs", () => {
  const projects = [projectOf("a", 100, 80), projectOf("b", 400, null), projectOf("c", 50, 60)];

  it("spreads every use case across the stage when nothing is focused", () => {
    const places = placeOrbs(projects, "wide", null);
    expect(Object.values(places).every((place) => !place.docked)).toBe(true);
    expect(places.a!.x).toBeLessThan(places.b!.x);
    expect(places.b!.r).toBeGreaterThan(places.a!.r);
  });

  it("docks the others when one is focused", () => {
    const places = placeOrbs(projects, "wide", "b");
    expect([places.a!.docked, places.b!.docked, places.c!.docked]).toEqual([true, false, true]);
    expect(places.b!.r).toBeGreaterThan(100);
  });
});

describe("lanePath", () => {
  const box = STAGES.wide.river;

  it("runs straight through the steps of a run without revisions", () => {
    const path = lanePath([visit("extract"), visit("investigate")], 100, box);
    expect(path).toBe(`M ${box.x} 100 L ${stepX("extract", box)} 100 L ${stepX("investigate", box)} 100`);
  });

  it("arcs back once per revision, each loop higher than the last", () => {
    const visits = [visit("propose"), visit("evaluate"), visit("propose", 1), visit("evaluate", 1), visit("propose", 2)];
    const lifts = [...lanePath(visits, 100, box).matchAll(/C [\d.]+ ([\d.]+)/g)].map((match) => Number(match[1]));
    expect(lifts).toHaveLength(2);
    expect(lifts[1]).toBeLessThan(lifts[0]!);
  });
});
