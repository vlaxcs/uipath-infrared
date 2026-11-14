import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { nextPreview } from "~/runs/nextPreview";
import { sampleRun } from "~/runs/sampleRun";
import { deriveStepStates } from "~/runs/stepProgress";
import { NextStepPreview } from "~/runs/NextStepPreview";

afterEach(cleanup);

describe("the next step preview", () => {
  it("describes the next step and moves the view on demand", () => {
    const run = cutSampleRun(14);
    const preview = nextPreview(run, "present", deriveStepStates(run.events, run));
    const onSelect = vi.fn();

    render(<NextStepPreview preview={preview} onSelect={onSelect} />);

    expect(screen.getByRole("heading", { name: "Next: Rehearse" })).toBeTruthy();
    expect(screen.getByText("Waits for the gate after it runs.")).toBeTruthy();
    expect(screen.getByText("Changing the view does not advance the run.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("disables the button on the last step", () => {
    const preview = nextPreview(sampleRun, "rehearse", deriveStepStates(sampleRun.events, sampleRun));
    render(<NextStepPreview preview={preview} onSelect={() => {}} />);

    expect(screen.getByRole("heading", { name: "Last step" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
