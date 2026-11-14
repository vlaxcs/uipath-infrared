import { describe, expect, it } from "vitest";
import {
  approvePlanDecision,
  DASHBOARD_ACTOR,
  keepAnalysesDecision,
  pickLayoutDecision,
} from "~/runs/decisions";

describe("dashboard decisions", () => {
  it("keeps analyses on the present step, trimmed and deduplicated", () => {
    expect(keepAnalysesDecision([" F001 ", "F002", "F001", ""], "these carry forward")).toEqual({
      step: "present",
      status: "approved",
      actor: DASHBOARD_ACTOR,
      decision: { kind: "keep_analyses", reason: "these carry forward", analyses: ["F001", "F002"] },
    });
  });

  it("picks a layout on the present step", () => {
    expect(pickLayoutDecision("managed_services", "stays in the EU")).toEqual({
      step: "present",
      status: "approved",
      actor: DASHBOARD_ACTOR,
      decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
    });
  });

  it("approves the plan on the rehearse step", () => {
    expect(approvePlanDecision("rehearsal held")).toEqual({
      step: "rehearse",
      status: "approved",
      actor: DASHBOARD_ACTOR,
      decision: { kind: "approve_plan", reason: "rehearsal held" },
    });
  });

  it("acts as the CTO on the dashboard", () => {
    expect(DASHBOARD_ACTOR).toEqual({ kind: "human", id: "cto", surface: "dashboard" });
  });
});
