import { describe, expect, it } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { nextPreview } from "~/runs/nextPreview";
import { sampleRun } from "~/runs/sampleRun";
import { deriveStepStates } from "~/runs/stepProgress";

describe("the next step preview", () => {
  it("describes the next automatic step and its expected result", () => {
    const run = cutSampleRun(14);
    const preview = nextPreview(run, "present", deriveStepStates(run.events, run));

    expect(preview).toMatchObject({
      step: "rehearse",
      title: "Rehearse",
      control: "approval",
      state: "pending",
      artifactPath: null,
      hint: "Waits for the gate after it runs.",
    });
  });

  it("points at the result of a finished next step", () => {
    const preview = nextPreview(sampleRun, "present", deriveStepStates(sampleRun.events, sampleRun));

    expect(preview.step).toBe("rehearse");
    expect(preview.state).toBe("done");
    expect(preview.artifactPath).toBe("rehearsal.json");
    expect(preview.hint).toBe("Result available.");
  });

  it("says when there is no next step", () => {
    const preview = nextPreview(sampleRun, "rehearse", deriveStepStates(sampleRun.events, sampleRun));

    expect(preview).toMatchObject({
      step: null,
      title: "Last step",
      control: "last",
      state: "done",
      artifactPath: null,
    });
  });
});
