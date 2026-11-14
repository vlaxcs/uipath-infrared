import { describe, expect, it } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import {
  latestRevision,
  nextStep,
  primaryArtifactPath,
  revisionLabel,
  revisionsForStep,
  stepEvents,
} from "~/runs/artifactRefs";

describe("artifact references", () => {
  it("lists the revisions a step ran for", () => {
    expect(revisionsForStep(sampleRun, "evaluate")).toEqual([0, 1]);
    expect(revisionsForStep(sampleRun, "extract")).toEqual([0]);
    expect(latestRevision(sampleRun, "propose")).toBe(1);
    expect(latestRevision(cutSampleRun(6), "evaluate")).toBeNull();
  });

  it("names the primary artifact of each step", () => {
    expect(primaryArtifactPath(sampleRun, "extract", 0)).toBe("infra.json");
    expect(primaryArtifactPath(sampleRun, "investigate", 0)).toBe("findings.json");
    expect(primaryArtifactPath(sampleRun, "propose", 1)).toBe("candidates.1.json");
    expect(primaryArtifactPath(sampleRun, "propose", null)).toBeNull();
    expect(primaryArtifactPath(sampleRun, "evaluate", 1)).toBe("result.1.json");
    expect(primaryArtifactPath(sampleRun, "present", 1)).toBe("result.1.json");
    expect(primaryArtifactPath(sampleRun, "rehearse", 1)).toBe("rehearsal.json");
  });

  it("prefers the path recorded by the event", () => {
    const run = {
      ...cutSampleRun(8),
      events: cutSampleRun(8).events.map((event) =>
        event.seq === 8 && event.output
          ? { ...event, output: { ...event.output, file: { ...event.output.file, path: "custom-result.json" } } }
          : event,
      ),
    };

    expect(primaryArtifactPath(run, "evaluate", 0)).toBe("custom-result.json");
  });

  it("walks the pipeline order", () => {
    expect(nextStep("extract")).toBe("investigate");
    expect(nextStep("present")).toBe("rehearse");
    expect(nextStep("rehearse")).toBeNull();
  });

  it("filters a step's events by revision", () => {
    expect(stepEvents(sampleRun, "present", 1).map((event) => event.seq)).toEqual([13, 14, 15, 16, 17]);
    expect(stepEvents(sampleRun, "present", 0)).toEqual([]);
  });

  it("labels revisions", () => {
    expect(revisionLabel(0)).toBe("Initial pass");
    expect(revisionLabel(2)).toBe("Revision 2");
  });
});
