import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { deriveStepStates } from "~/runs/stepProgress";
import { StepRail } from "~/runs/StepRail";

afterEach(cleanup);

describe("the step rail", () => {
  it("marks the selected and executing steps separately", () => {
    const run = cutSampleRun(14);
    const states = deriveStepStates(run.events, run);
    const onSelectStep = vi.fn();

    render(<StepRail run={run} states={states} selectedStep="extract" onSelectStep={onSelectStep} />);
    const list = screen.getByRole("list", { name: "Steps" });

    const extract = within(list).getByRole("button", { name: /Extract/ });
    expect(extract.getAttribute("aria-pressed")).toBe("true");
    expect(extract.getAttribute("aria-current")).toBeNull();
    expect(within(extract).getByText("Automatic")).toBeTruthy();

    const present = within(list).getByRole("button", { name: /Present/ });
    expect(present.getAttribute("aria-pressed")).toBe("false");
    expect(present.getAttribute("aria-current")).toBe("step");
    expect(within(present).getByText("Awaiting approval")).toBeTruthy();
    expect(within(present).getByText("Needs approval")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: /Evaluate/ }));
    expect(onSelectStep).toHaveBeenCalledWith("evaluate");
  });

  it("lists every step in pipeline order", () => {
    const run = cutSampleRun(14);
    render(
      <StepRail
        run={run}
        states={deriveStepStates(run.events, run)}
        selectedStep="extract"
        onSelectStep={() => {}}
      />,
    );

    const buttons = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("Extract"),
      expect.stringContaining("Investigate"),
      expect.stringContaining("Propose"),
      expect.stringContaining("Evaluate"),
      expect.stringContaining("Present"),
      expect.stringContaining("Rehearse"),
    ]);
  });
});
