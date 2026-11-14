import { describe, expect, it } from "vitest";
import {
  componentStatusMeta,
  decisionMeta,
  failureLabel,
  failureNoun,
  FALLBACK_META,
  patternLabel,
  phaseLabel,
  provenanceLabel,
  teardownMeta,
} from "~/rehearsal/labels";

describe("rehearsal vocabulary", () => {
  it("labels traffic patterns and failure types, keeping unknowns readable", () => {
    expect(patternLabel("constant")).toBe("Constant");
    expect(patternLabel("wobble")).toBe("Wobble");
    expect(failureLabel("instance_stop")).toBe("Instance stop");
    expect(failureLabel("meteor")).toBe("Meteor");
    expect(failureNoun("instance_stop")).toBe("instance");
    expect(failureNoun("meteor")).toBe("component");
  });

  it("maps component statuses and provenance to labels and tones", () => {
    expect(componentStatusMeta("healthy")).toEqual({ label: "Healthy", tone: "completed" });
    expect(componentStatusMeta("degraded")).toEqual({ label: "Degraded", tone: "awaiting" });
    expect(componentStatusMeta("failed")).toEqual({ label: "Failed", tone: "failed" });
    expect(componentStatusMeta("on_fire")).toEqual({ label: "On fire", tone: "neutral" });
    expect(provenanceLabel("synthetic")).toBe("Synthetic");
    expect(provenanceLabel("guessed")).toBe("Guessed");
  });

  it("maps decisions and teardown states", () => {
    expect(decisionMeta("proceed")).toEqual({ label: "Proceed", tone: "completed" });
    expect(decisionMeta("revise")).toEqual({ label: "Revise", tone: "awaiting" });
    expect(decisionMeta("rethink")).toEqual({ label: "Rethink", tone: "neutral" });
    expect(teardownMeta("success")).toEqual({ label: "Teardown succeeded", tone: "completed" });
    expect(teardownMeta("partial")).toEqual({ label: "Teardown partial", tone: "awaiting" });
    expect(teardownMeta("failed")).toEqual({ label: "Teardown failed", tone: "failed" });
  });

  it("labels the phases and the fallback verdicts", () => {
    expect(phaseLabel("baseline")).toBe("Before the failure");
    expect(phaseLabel("failure")).toBe("During the failure");
    expect(phaseLabel("recovery")).toBe("After recovery");
    expect(FALLBACK_META.Held.tone).toBe("completed");
    expect(FALLBACK_META.Missed.tone).toBe("failed");
    expect(FALLBACK_META["Not evidenced"].tone).toBe("neutral");
  });
});
