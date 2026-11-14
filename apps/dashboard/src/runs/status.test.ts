import { describe, expect, it } from "vitest";
import {
  decisionMeta,
  eventStatusMeta,
  formatActor,
  gateMeta,
  runStatusLabel,
  runStatusMeta,
  stepStateMeta,
} from "~/runs/status";
import type { Run } from "~/runs/types";

const run: Run = {
  id: "run-demo-shop-0001",
  project: "demo-shop",
  status: "awaiting_approval",
  step: "present",
  revision: 1,
  max_revisions: 2,
  started_at: "2026-11-14T09:00:00Z",
  updated_at: "2026-11-14T09:12:02Z",
  awaiting: "layout",
  inputs: {
    forecast: { path: "forecast.json", sha256: "a" },
    catalog: { path: "catalog.json", sha256: "b" },
  },
};

describe("run and event statuses", () => {
  it("keeps the two vocabularies apart", () => {
    expect(Object.keys(runStatusMeta).sort()).toEqual(["awaiting_approval", "completed", "failed", "running"]);
    expect(Object.keys(eventStatusMeta).sort()).toEqual([
      "approved",
      "awaiting_approval",
      "completed",
      "failed",
      "started",
    ]);
    expect("approved" in runStatusMeta).toBe(false);
    expect("running" in eventStatusMeta).toBe(false);
  });

  it("labels and tones the statuses", () => {
    expect(runStatusMeta.awaiting_approval).toEqual({ label: "Awaiting approval", tone: "awaiting" });
    expect(eventStatusMeta.approved).toEqual({ label: "Approved", tone: "completed" });
    expect(eventStatusMeta.started.tone).toBe("running");
  });

  it("names the gate a paused run is waiting on", () => {
    expect(runStatusLabel(run)).toBe("Awaiting layout");
    expect(runStatusLabel({ ...run, awaiting: "plan" })).toBe("Awaiting plan");
    expect(runStatusLabel({ ...run, status: "completed", awaiting: undefined })).toBe("Completed");
  });

  it("labels human and orchestrator actors", () => {
    expect(formatActor({ kind: "orchestrator" })).toBe("Orchestrator");
    expect(formatActor({ kind: "human", id: "cto", surface: "dashboard" })).toBe("cto (dashboard)");
    expect(formatActor({ kind: "human", id: "cto", surface: "slack" })).toBe("cto (slack)");
  });

  it("covers every decision, gate and step state", () => {
    expect(Object.keys(decisionMeta).sort()).toEqual([
      "approve_plan",
      "keep_analyses",
      "pick_layout",
      "proceed",
      "revise",
      "stop",
    ]);
    expect(Object.keys(gateMeta).sort()).toEqual(["layout", "plan"]);
    expect(Object.keys(stepStateMeta).sort()).toEqual(["awaiting", "current", "done", "failed", "pending"]);
  });
});
