import { describe, expect, it } from "vitest";
import { formatEUR, formatHours, formatTimestamp } from "~/domain/format";
import { gateMeta, runStatusLabel, stepStateMeta } from "~/domain/status";

describe("formatting", () => {
  it("formats euros without cents and a missing price as a dash", () => {
    expect(formatEUR(74365)).toBe("€74,365");
    expect(formatEUR(null)).toBe("—");
  });

  it("formats monthly hours", () => {
    expect(formatHours(3)).toBe("3 h/mo");
    expect(formatHours(3.25)).toBe("3.3 h/mo");
  });

  it("formats timestamps in UTC", () => {
    expect(formatTimestamp("2026-11-14T09:00:00Z")).toBe("14 Nov 2026, 09:00");
  });
});

describe("labels", () => {
  it("names the gate the run is waiting at", () => {
    expect(runStatusLabel({ status: "awaiting_approval", awaiting: "layout" })).toBe("Awaiting layout");
    expect(runStatusLabel({ status: "awaiting_approval", awaiting: "plan" })).toBe("Awaiting plan");
    expect(runStatusLabel({ status: "completed" })).toBe("Completed");
  });

  it("has a label for every step state and gate", () => {
    for (const state of ["pending", "current", "awaiting", "done", "failed"] as const) {
      expect(stepStateMeta[state].label).toBeTruthy();
    }
    expect(gateMeta.layout.label).toBe("Layout");
    expect(gateMeta.plan.label).toBe("Plan approval");
  });
});
