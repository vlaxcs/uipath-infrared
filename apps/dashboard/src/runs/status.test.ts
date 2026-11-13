import { describe, expect, it } from "vitest";
import { eventStatusMeta, runStatusMeta } from "~/runs/status";

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
});
