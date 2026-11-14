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
          { id: "a", label: "Migration plan · managed", beside: "present", file: "states.1.managed.json", candidate: "managed", state: "done" },
          { id: "b", label: "Migration plan · lift", beside: "rehearse", file: "states.1.lift.json", candidate: "lift", state: "running" },
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

  it("draws the workflow around the steps: the checks, the gates, the revision loop and phase 2", () => {
    const run = cutSampleRun(14);
    render(<StepGraph run={run} states={deriveStepStates(run.events, run)} selectedStep={null} onSelectStep={() => {}} trials={2} />);

    expect(screen.getByRole("group", { name: "Revision loop" }).textContent).toContain("Revision loop");
    for (const text of ["Matches the infra contract?", "Every agent candidate feasible?", "CTO picks a feasible layout", "Availability meets the forecast?", "CTO approves the plan", "Trials: 2"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "Phase 2" }).textContent).toContain("not built yet");
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("selects a step from the keyboard", () => {
    const run = cutSampleRun(14);
    const onSelectStep = vi.fn();
    render(<StepGraph run={run} states={deriveStepStates(run.events, run)} selectedStep={null} onSelectStep={onSelectStep} />);
    const evaluate = within(screen.getByRole("list", { name: "Steps" })).getByRole("button", { name: /Evaluate/ });
    fireEvent.keyDown(evaluate, { key: "Enter" });
    expect(onSelectStep).toHaveBeenCalledWith("evaluate");
  });

  it("opens a built migration plan from its node in the diagram", () => {
    const run = cutSampleRun(14);
    const onSelectPlan = vi.fn();
    render(
      <StepGraph
        run={run}
        states={deriveStepStates(run.events, run)}
        selectedStep={null}
        onSelectStep={() => {}}
        onSelectPlan={onSelectPlan}
        parallel={[
          { id: "a", label: "Migration plan · managed", beside: "present", file: "states.1.managed.json", candidate: "managed", state: "done" },
          { id: "b", label: "Migration plan · lift", beside: "rehearse", file: "states.1.lift.json", candidate: "lift", state: "running" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open the migration plan of managed" }));
    expect(onSelectPlan).toHaveBeenCalledWith("managed");
    expect(screen.queryByRole("button", { name: "Open the migration plan of lift" })).toBeNull();
  });
});

