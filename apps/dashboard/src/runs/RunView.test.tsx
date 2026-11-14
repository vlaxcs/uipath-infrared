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

const status = () => screen.getByRole("group", { name: "Run status" });

describe("the run view", () => {
  it("shows the run's state beside the pipeline, and opens a step in a dialog", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);

    expect(status().textContent).toContain("Completed");
    expect(screen.queryByRole("dialog")).toBeNull();

    const steps = screen.getByRole("list", { name: "Steps" });
    for (const title of ["Extract", "Investigate", "Propose", "Evaluate", "Present", "Rehearse"]) {
      expect(within(steps).getByText(title)).toBeTruthy();
    }
    const executing = within(steps).getByRole("button", { name: /Rehearse/ });
    expect(executing.getAttribute("aria-current")).toBe("step");
    expect(executing.getAttribute("aria-pressed")).toBe("false");

    clickStep("Rehearse");

    const dialog = screen.getByRole("dialog", { name: "Rehearse" });
    expect(await within(dialog).findByText("Passed")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Log" }));
    expect(dialog.textContent).toContain("approve_plan");
    expect(dialog.textContent).toContain("cto (slack)");

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    const present = screen.getByRole("dialog", { name: "Present" });
    expect(present.textContent).toContain("keep_analyses");
    expect(present.textContent).toContain("pick_layout");
    expect(present.textContent).toContain("cto (dashboard)");

    fireEvent.click(within(present).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("walks the steps with the arrows and keeps what happened apart from the log", async () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);
    const steps = screen.getByRole("list", { name: "Steps" });

    clickStep("Extract");

    const dialog = screen.getByRole("dialog", { name: "Extract" });
    expect(within(dialog).getByRole("tab", { name: "What happened" }).getAttribute("aria-selected")).toBe("true");
    expect(await within(dialog).findByText("hand-written-mock")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Previous step: Analyze/ })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Log" }));
    expect(within(dialog).getByRole("heading", { name: "Events" })).toBeTruthy();
    expect(within(dialog).queryByText("hand-written-mock")).toBeNull();

    fireEvent.click(within(dialog).getByRole("tab", { name: "What happened" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next step: Investigate" }));

    expect(screen.getByRole("dialog", { name: "Investigate" })).toBeTruthy();
    expect(await screen.findByText("The GPU node group is idle")).toBeTruthy();
    expect(within(steps).getByRole("button", { name: /Investigate/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(steps).getByRole("button", { name: /Extract/ }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(screen.getByRole("dialog", { name: "Extract" })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the layout gate from the status and submits pick_layout", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(16));
    render(<RunView run={cutSampleRun(14)} source={sourceWith({ submitDecision })} />);

    expect(status().textContent).toContain("Waiting for your decision");
    fireEvent.click(within(status()).getByRole("button", { name: "Pick a layout" }));
    expect(screen.getByRole("dialog", { name: "Evaluate" })).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
    const highest = await screen.findByRole("radio", { name: /consolidate/ });
    expect((highest as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: /managed_services/ }));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(await screen.findByText("Why this one?")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "stays in the EU" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(submitDecision).toHaveBeenCalledTimes(1));
    expect(submitDecision).toHaveBeenCalledWith("run-demo-shop-0001", {
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
    });

    await waitFor(() => expect(within(status()).queryByRole("button", { name: "Pick a layout" })).toBeNull());
  });

  it("keeps analyses at the layout gate without closing it", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(15));
    render(<RunView run={cutSampleRun(14)} source={sourceWith({ submitDecision })} />);

    fireEvent.click(within(status()).getByRole("button", { name: "Pick a layout" }));

    expect(await screen.findByRole("checkbox", { name: /The GPU node group is idle/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /The ERP database waits/ }));
    fireEvent.click(screen.getByRole("button", { name: "Keep these" }));
    expect(await screen.findByText("Why keep them?")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason for keeping"), { target: { value: "these stand" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

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

    expect(await screen.findByText(/I kept all 2 for the next plans/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Choose" })).toBeTruthy();
    expect(within(status()).getByRole("button", { name: "Pick a layout" })).toBeTruthy();
  });

  it("opens the gated step when the route asks for it", async () => {
    render(<RunView run={cutSampleRun(14)} source={sampleRunSource} initialStep="present" />);

    expect(screen.getByRole("dialog", { name: "Present" })).toBeTruthy();
    expect(await screen.findByText(/Which should I keep for the next plans/)).toBeTruthy();
  });

  it("opens the rehearse step for the plan gate", () => {
    render(<RunView run={cutSampleRun(20)} source={sampleRunSource} initialStep="rehearse" />);

    expect(screen.getByRole("dialog", { name: "Rehearse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve plan" })).toBeTruthy();
  });

  it("reviews the plan gate and submits approve_plan", async () => {
    const submitDecision = vi.fn().mockResolvedValue(eventAt(21));
    render(<RunView run={cutSampleRun(20)} source={sourceWith({ submitDecision })} />);

    fireEvent.click(within(status()).getByRole("button", { name: "Review the plan" }));

    expect(screen.getByRole("dialog", { name: "Rehearse" })).toBeTruthy();
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

  it("follows the live run in the status and the pipeline", async () => {
    vi.useFakeTimers();
    const source = sourceWith({ mode: "live", eventsAfter: async () => [eventAt(18)] });
    render(<RunView run={cutSampleRun(17)} source={source} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const steps = screen.getByRole("list", { name: "Steps" });
    expect(within(steps).getByRole("button", { name: /Rehearse/ }).getAttribute("aria-current")).toBe("step");
    expect(status().textContent).toContain("Working on Rehearse");
  });

  it("shows above the status whether the Slack bot is connected", async () => {
    const slackStatus = vi.fn().mockResolvedValue({ connected: true, channel: "infrared-runs" });
    render(<RunView run={cutSampleRun(14)} source={sourceWith({ slackStatus })} />);
    expect(await within(status()).findByText("Slack connected · #infrared-runs")).toBeTruthy();
  });

  it("renders a failed run", () => {
    render(<RunView run={failedRun} source={sampleRunSource} />);
    expect(status().textContent).toContain("Stopped");
    expect(screen.getByRole("list", { name: "Steps" }).closest("svg")?.textContent).toContain("Failed at");
  });

  it("shows a polling error without losing the run", async () => {
    vi.useFakeTimers();
    const source = sourceWith({ eventsAfter: vi.fn().mockRejectedValue(new Error("offline")) });
    render(<RunView run={cutSampleRun(14)} source={source} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(within(status()).getByRole("alert").textContent).toContain("offline");
    expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy();
  });
});

describe("starting again from a finished run", () => {
  it("offers the project's active run instead of a start the platform would refuse", () => {
    const onOpenRun = vi.fn();
    render(<RunView run={failedRun} source={sourceWith({ mode: "live" })} onStartAgain={vi.fn()} activeRunId="run-checkout-0002" onOpenRun={onOpenRun} />);
    expect(screen.queryByRole("button", { name: "Run again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open the active run" }));
    expect(onOpenRun).toHaveBeenCalledWith("run-checkout-0002");
  });

  it("runs the project again when nothing else is running", () => {
    const onStartAgain = vi.fn();
    render(<RunView run={failedRun} source={sourceWith({ mode: "live" })} onStartAgain={onStartAgain} />);
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    expect(onStartAgain).toHaveBeenCalled();
  });
});

describe("resuming a failed run", () => {
  it("offers to resume from the step it failed at", () => {
    const onResume = vi.fn();
    render(<RunView run={failedRun} source={sourceWith({ mode: "live" })} onStartAgain={vi.fn()} onResume={onResume} />);
    expect(screen.queryByRole("button", { name: "Run again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Resume from ${failedRun.step.charAt(0).toUpperCase()}${failedRun.step.slice(1)}` }));
    expect(onResume).toHaveBeenCalled();
  });
});
