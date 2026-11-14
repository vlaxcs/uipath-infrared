import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun, failedRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import type { RunEvent } from "~/runs/types";
import { RunView } from "~/runs/RunView";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const eventAt = (seq: number): RunEvent => sampleRun.events.find((event) => event.seq === seq)!;

function sourceWith(overrides: Partial<RunSource>): RunSource {
  return { ...sampleRunSource, ...overrides };
}

function clickStep(title: string) {
  const list = screen.getByRole("list", { name: "Steps" });
  fireEvent.click(within(list).getByRole("button", { name: new RegExp(title) }));
}

describe("the run view", () => {
  it("shows the current run's details before a step is selected, then the step's result", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);

    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();
    const summary = screen.getByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(summary.textContent).toContain("rehearse");
    expect(summary.textContent).toContain("1 / 2");
    expect(summary.textContent).toContain("forecast.json");

    const steps = screen.getByRole("list", { name: "Steps" });
    for (const title of ["Extract", "Investigate", "Propose", "Evaluate", "Present", "Rehearse"]) {
      expect(within(steps).getByText(title)).toBeTruthy();
    }
    const executing = within(steps).getByRole("button", { name: /Rehearse/ });
    expect(executing.getAttribute("aria-current")).toBe("step");
    expect(executing.getAttribute("aria-pressed")).toBe("false");

    clickStep("Rehearse");

    expect(screen.getByRole("heading", { level: 2, name: "Rehearse" })).toBeTruthy();
    expect(await screen.findByText("Passed")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Run overview" })).toBeNull();

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline.textContent).toContain("keep_analyses");
    expect(timeline.textContent).toContain("the GPU and orphan findings stand; the ERP one waits for the vendor");
    expect(timeline.textContent).toContain("pick_layout");
    expect(timeline.textContent).toContain("managed_services");
    expect(timeline.textContent).toContain("approve_plan");
    expect(timeline.textContent).toContain("cto (dashboard)");
    expect(timeline.textContent).toContain("cto (slack)");
    expect(timeline.textContent).toContain("result.1.json");
    expect(timeline.textContent).toContain("rehearsal.json");
    expect(screen.queryByText("A layout is waiting to be picked")).toBeNull();

    clickStep("Rehearse");
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();
  });

  it("shows the results of the clicked step and previews the next one", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    const steps = screen.getByRole("list", { name: "Steps" });

    clickStep("Extract");

    expect(screen.getByRole("heading", { level: 2, name: "Extract" })).toBeTruthy();
    expect(await screen.findByText("hand-written-mock")).toBeTruthy();
    expect(screen.getByText("38")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Next: Investigate" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByRole("heading", { level: 2, name: "Investigate" })).toBeTruthy();
    expect(await screen.findByText("The GPU node group is idle")).toBeTruthy();
    expect(screen.getAllByText(/gpu_pct average 0\.4/).length).toBeGreaterThan(0);
    expect(within(steps).getByRole("button", { name: /Investigate/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(steps).getByRole("button", { name: /Extract/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("reviews the layout gate from the overview and submits pick_layout", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(16));
    render(<RunView run={cutSampleRun(14)} source={sourceWith({ submitDecision })} />);

    const banner = screen.getByRole("region", { name: "A layout is waiting to be picked" });
    expect(banner.textContent).toContain("Keep analyses, then pick the layout to rehearse.");
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Review the gate" }));

    const highest = await screen.findByRole("radio", { name: /consolidate/ });
    await waitFor(() => expect((highest as HTMLInputElement).checked).toBe(true));
    expect(screen.getByRole("radio", { name: /managed_services/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /managed_services/ }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "stays in the EU" } });
    fireEvent.click(screen.getByRole("button", { name: "Pick layout" }));

    await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
    expect(submitDecision).toHaveBeenCalledWith("run-demo-shop-0001", {
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
    });

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "A layout is waiting to be picked" })).toBeNull(),
    );
    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline.textContent).toContain("pick_layout");
  });

  it("keeps analyses at the layout gate without closing it", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(15));
    render(<RunView run={cutSampleRun(14)} source={sourceWith({ submitDecision })} />);

    fireEvent.click(screen.getByRole("button", { name: "Review the gate" }));

    expect(await screen.findByRole("checkbox", { name: /The GPU node group is idle/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /The ERP database waits/ }));
    fireEvent.change(screen.getByLabelText("Reason for keeping"), { target: { value: "these stand" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep selected analyses" }));

    await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
    expect(submitDecision).toHaveBeenCalledWith("run-demo-shop-0001", {
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: {
        kind: "keep_analyses",
        reason: "these stand",
        analyses: ["idle-gpu-nodes", "orphan-volumes"],
      },
    });

    expect(screen.getByRole("heading", { name: "A layout is waiting to be picked" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick layout" })).toBeTruthy();
    const banner = screen.getByRole("region", { name: "A layout is waiting to be picked" });
    await waitFor(() => expect(banner.textContent).toContain("keep_analyses"));
    expect(banner.textContent).toContain("idle-gpu-nodes");
    expect(banner.textContent).toContain("orphan-volumes");
  });

  it("pins the gated step when the route asks for it", async () => {
    render(<RunView run={cutSampleRun(14)} source={sampleRunSource} initialStep="present" />);

    expect(screen.getByRole("heading", { level: 2, name: "Present" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Run overview" })).toBeNull();
    expect(screen.getByText("Keep analyses")).toBeTruthy();
  });

  it("pins the rehearse step for the plan gate", () => {
    render(<RunView run={cutSampleRun(20)} source={sampleRunSource} initialStep="rehearse" />);

    expect(screen.getByRole("heading", { level: 2, name: "Rehearse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve plan" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Run overview" })).toBeNull();
  });

  it("reviews the plan gate and submits approve_plan", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(21));
    render(<RunView run={cutSampleRun(20)} source={sourceWith({ submitDecision })} />);

    expect(screen.getByRole("heading", { name: "The plan is waiting for approval" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review the gate" }));

    expect(screen.getByRole("heading", { level: 2, name: "Rehearse" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "rehearsal held" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve plan" }));

    await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
    expect(submitDecision).toHaveBeenCalledWith("run-demo-shop-0001", {
      step: "rehearse",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "approve_plan", reason: "rehearsal held" },
    });
  });

  it("keeps the overview live and returns to it from a pinned step", async () => {
    vi.useFakeTimers();
    const source = sourceWith({ mode: "live", eventsAfter: async () => [eventAt(18)] });
    render(<RunView run={cutSampleRun(17)} source={source} />);

    expect(screen.getByRole("button", { name: "Following live" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const steps = screen.getByRole("list", { name: "Steps" });
    expect(within(steps).getByRole("button", { name: /Rehearse/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("region", { name: "demo-shop" }).textContent).toContain("rehearse");
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();

    clickStep("Extract");
    expect(screen.getByRole("heading", { level: 2, name: "Extract" })).toBeTruthy();
    const follow = screen.getByRole("button", { name: "Follow live" });
    expect(follow.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(follow);
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Following live" })).toBeTruthy();
  });

  it("renders a failed run", () => {
    render(<RunView run={failedRun} source={sampleRunSource} />);
    expect(screen.getByRole("region", { name: "checkout" }).textContent).toContain("Failed");
    expect(screen.getByRole("region", { name: "Timeline" }).textContent).toContain(
      "the engine could not price the baseline",
    );
  });

  it("shows a polling error without losing the run", async () => {
    vi.useFakeTimers();
    const source = sourceWith({ eventsAfter: vi.fn().mockRejectedValue(new Error("offline")) });
    render(<RunView run={cutSampleRun(14)} source={source} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByRole("alert").textContent).toContain("offline");
    expect(screen.getByRole("region", { name: "demo-shop" })).toBeTruthy();
  });
});
