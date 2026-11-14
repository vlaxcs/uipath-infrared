import { describe, expect, it } from "vitest";
import { deriveRun, groupProjects, latestArtifactPaths, projectLabel, pulseOf, stepVisits } from "~/insights/derive";
import type { RunDetail, RunEvent } from "~/runs/types";

const orchestrator = { kind: "orchestrator" } as const;
const cto = { kind: "human", id: "cto", surface: "slack" } as const;

function event(seq: number, step: RunEvent["step"], status: RunEvent["status"], extra: Partial<RunEvent> = {}): RunEvent {
  return { seq, at: `2026-11-14T09:00:${String(seq).padStart(2, "0")}Z`, step, status, revision: 0, actor: orchestrator, ...extra };
}

const events: RunEvent[] = [
  event(1, "extract", "started"),
  event(2, "extract", "completed"),
  event(3, "evaluate", "started"),
  event(4, "evaluate", "completed", { decision: { kind: "revise", reason: "over budget" } }),
  event(5, "propose", "started", { revision: 1 }),
  event(6, "propose", "completed", { revision: 1 }),
  event(7, "present", "started", { revision: 1 }),
  event(8, "present", "awaiting_approval", { revision: 1, gate: "layout" }),
  event(9, "present", "approved", { revision: 1, actor: cto, decision: { kind: "pick_layout", reason: "EU", layout: "b" } }),
  event(10, "present", "completed", { revision: 1 }),
  event(11, "rehearse", "started", { revision: 1 }),
  event(12, "rehearse", "awaiting_approval", { revision: 1, gate: "plan" }),
];

function run(status: RunDetail["status"], project = "demo-shop", id = "run-1", list = events): RunDetail {
  return {
    schema_version: "1.0",
    id,
    project,
    status,
    step: "rehearse",
    revision: 1,
    max_revisions: 2,
    started_at: list[0]!.at,
    updated_at: list[list.length - 1]!.at,
    inputs: { forecast: { path: "forecast.json", sha256: "" }, catalog: { path: "catalog.json", sha256: "" } },
    events: list,
  };
}

const result = {
  baseline: { monthly_eur: 100, availability_pct: 99 },
  winner: "a",
  candidates: [
    { id: "a", source: "engine", feasible: true, cost: { run_eur_month_now: 80 }, availability_pct: 99.5 },
    { id: "b", source: "agent", feasible: true, cost: { run_eur_month_now: 90 }, availability_pct: 99.9 },
    { id: "c", source: "engine", feasible: false, cost: { run_eur_month_now: 40 } },
  ],
};

describe("deriveRun", () => {
  it("prices the layout the person picked, not the engine's winner", () => {
    const insight = deriveRun(run("awaiting_approval"), { result, findings: { findings: [{}, {}] }, infra: { components: [{}, {}, {}] } });

    expect(insight.layout).toBe("b");
    expect(insight.winner).toBe("a");
    expect([insight.before, insight.after]).toEqual([100, 90]);
    expect(insight.availabilityAfter).toBe(99.9);
    expect(insight.candidates.map((candidate) => [candidate.id, candidate.picked, candidate.winner])).toEqual([
      ["a", false, true],
      ["b", true, false],
      ["c", false, false],
    ]);
    expect([insight.findings, insight.components, insight.revisions]).toEqual([2, 3, 1]);
    expect(insight.calls).toEqual([
      { kind: "pick_layout", by: "cto", surface: "slack", at: Date.parse(events[8]!.at), reason: "EU", layout: "b" },
    ]);
  });

  it("falls back to the winner before a layout is picked, and keeps the stop reason of a failed run", () => {
    const failed = [event(1, "evaluate", "started"), event(2, "evaluate", "failed", { decision: { kind: "stop", reason: "breaks budget" } })];
    const insight = deriveRun(run("failed", "demo-shop", "run-2", failed), { result });

    expect(insight.after).toBe(80);
    expect(insight.stopReason).toBe("breaks budget");
    expect(insight.rehearsal).toBeNull();
  });

  it("reads the rehearsal verdict", () => {
    const rehearsal = { verdict: { passed: true, measured_availability_pct: 99.94, forecast_min_availability_pct: 99.9 } };
    expect(deriveRun(run("completed"), { rehearsal }).rehearsal).toEqual({ passed: true, measured: 99.94, floor: 99.9 });
  });
});

describe("stepVisits", () => {
  it("lists one visit per step pass, with the revision loop and the open gate", () => {
    const visits = stepVisits(events, "awaiting_approval");

    expect(visits.map((visit) => [visit.step, visit.revision, visit.state, visit.gate ?? null, visit.gateOpen ?? null])).toEqual([
      ["extract", 0, "done", null, null],
      ["evaluate", 0, "done", null, null],
      ["propose", 1, "done", null, null],
      ["present", 1, "done", "layout", false],
      ["rehearse", 1, "awaiting", "plan", true],
    ]);
  });
});

describe("stepVisits after a decision", () => {
  it("closes a gate on a stop, and marks that visit failed", () => {
    const stopped = [
      event(1, "rehearse", "started"),
      event(2, "rehearse", "awaiting_approval", { gate: "plan" }),
      event(3, "rehearse", "approved", { actor: cto, decision: { kind: "stop", reason: "not now" } }),
    ];
    expect(stepVisits(stopped, "failed").map((visit) => [visit.state, visit.gateOpen])).toEqual([["failed", false]]);
  });

  it("keeps the layout gate open after keep_analyses, until the pick", () => {
    const kept = [
      event(1, "present", "started"),
      event(2, "present", "awaiting_approval", { gate: "layout" }),
      event(3, "present", "approved", { actor: cto, decision: { kind: "keep_analyses", reason: "", analyses: [] } }),
    ];
    expect(stepVisits(kept, "awaiting_approval").map((visit) => [visit.state, visit.gateOpen])).toEqual([["awaiting", true]]);
  });

  it("settles an awaiting visit once a later step starts", () => {
    const moved = [
      event(1, "present", "awaiting_approval", { gate: "layout" }),
      event(2, "rehearse", "started"),
    ];
    expect(stepVisits(moved, "running").map((visit) => [visit.step, visit.state, visit.gateOpen ?? null])).toEqual([
      ["present", "done", false],
      ["rehearse", "current", null],
    ]);
  });

  it("never leaves the last visit of a failed run looking live", () => {
    expect(stepVisits([event(1, "propose", "started")], "failed").map((visit) => visit.state)).toEqual(["failed"]);
  });
});

describe("groupProjects and pulseOf", () => {
  it("rolls runs up per project from the newest completed run", () => {
    const later = events.map((item) => ({ ...item, at: item.at.replace("09:00", "10:00") }));
    const projects = groupProjects([
      deriveRun(run("completed", "demo-shop", "run-1"), { result, findings: { findings: [{}] } }),
      deriveRun(run("running", "demo-shop", "run-2", later), {}),
      deriveRun(run("completed", "clinic", "run-3"), { result: { ...result, baseline: { monthly_eur: 50 } } }),
    ]);

    expect(projects.map((project) => [project.id, project.runs.map((item) => item.id), project.settled?.id])).toEqual([
      ["clinic", ["run-3"], "run-3"],
      ["demo-shop", ["run-2", "run-1"], "run-1"],
    ]);
    const pulse = pulseOf(projects);
    expect(pulse.monthlyDelta).toBe(90 - 50 + (90 - 100));
    expect([pulse.projects, pulse.runs, pulse.calls, pulse.candidates]).toEqual([2, 3, 3, 6]);
  });
});

describe("helpers", () => {
  it("picks the highest revision of each artifact", () => {
    expect(latestArtifactPaths(["result.0.json", "result.2.json", "result.10.json", "rehearsal.1.json", "infra.json"])).toEqual({
      result: "result.10.json",
      rehearsal: "rehearsal.1.json",
    });
  });

  it("turns a project id into a label", () => {
    expect(projectLabel("fleet-telemetry")).toBe("Fleet Telemetry");
  });
});
