import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { deriveStepStates } from "~/runs/stepProgress";
import { StepGraph } from "~/runs/StepGraph";

afterEach(cleanup);

describe("the step graph", () => {
  it("shows the pipeline in order with the executing step marked", () => {
    const run = cutSampleRun(14);
    render(
      <StepGraph
        run={run}
        states={deriveStepStates(run.events, run)}
        selectedStep={null}
        onSelectStep={() => {}}
      />,
    );

    const nodes = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("button");
    expect(nodes.map((node) => node.textContent)).toEqual([
      expect.stringContaining("Extract"),
      expect.stringContaining("Investigate"),
      expect.stringContaining("Propose"),
      expect.stringContaining("Evaluate"),
      expect.stringContaining("Present"),
      expect.stringContaining("Rehearse"),
    ]);
    expect(nodes.every((node) => node.getAttribute("aria-pressed") === "false")).toBe(true);

    const present = within(screen.getByRole("list", { name: "Steps" })).getByRole("button", {
      name: /Present/,
    });
    expect(present.getAttribute("aria-current")).toBe("step");
    expect(within(present).getByText("Awaiting approval")).toBeTruthy();
    expect(within(present).getByText("Needs approval · Layout")).toBeTruthy();
  });

  it("marks the selected step and reports a click", () => {
    const run = cutSampleRun(14);
    const onSelectStep = vi.fn();
    render(
      <StepGraph
        run={run}
        states={deriveStepStates(run.events, run)}
        selectedStep="extract"
        onSelectStep={onSelectStep}
      />,
    );

    const list = screen.getByRole("list", { name: "Steps" });
    const extract = within(list).getByRole("button", { name: /Extract/ });
    expect(extract.getAttribute("aria-pressed")).toBe("true");
    expect(extract.getAttribute("aria-current")).toBeNull();
    expect(within(extract).getByText("Automatic")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: /Evaluate/ }));
    expect(onSelectStep).toHaveBeenCalledWith("evaluate");
  });

  it("shows the plan builds that run beside Present and Rehearse, with their state", () => {
    const run = cutSampleRun(14);
    render(
      <StepGraph
        run={run}
        states={deriveStepStates(run.events, run)}
        selectedStep={null}
        onSelectStep={() => {}}
        parallel={[
          { id: "a", label: "Migration plan · managed", beside: "present", file: "states.1.managed.json", state: "done" },
          { id: "b", label: "Migration plan · lift", beside: "rehearse", file: "states.1.lift.json", state: "running" },
        ]}
      />,
    );

    const present = screen.getByRole("list", { name: "In parallel with Present" });
    expect(present.textContent).toContain("Migration plan · managed");
    expect(present.textContent).toContain("Built");
    const rehearse = screen.getByRole("list", { name: "In parallel with Rehearse" });
    expect(rehearse.textContent).toContain("Building");
    expect(screen.queryByRole("list", { name: "In parallel with Extract" })).toBeNull();
  });
});
