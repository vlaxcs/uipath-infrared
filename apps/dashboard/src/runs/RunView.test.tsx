import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun, failedRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import { RunView } from "~/runs/RunView";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the run view", () => {
  it("renders the sample run's steps, revisions, decisions and outputs", () => {
    render(<RunView run={sampleRun} source={sampleRunSource} />);

    const summary = screen.getByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(summary.textContent).toContain("rehearse");
    expect(summary.textContent).toContain("1 / 2");
    expect(summary.textContent).toContain("forecast.json");

    const steps = screen.getByRole("list", { name: "Steps" });
    for (const step of ["extract", "investigate", "propose", "evaluate", "present", "rehearse"]) {
      expect(within(steps).getByText(step)).toBeTruthy();
    }

    expect(screen.getByRole("heading", { name: "Initial pass" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Revision 1" })).toBeTruthy();

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(timeline.textContent).toContain("keep_analyses");
    expect(timeline.textContent).toContain("the GPU and orphan findings stand; the ERP one waits for the vendor");
    expect(timeline.textContent).toContain("pick_layout");
    expect(timeline.textContent).toContain("managed_services");
    expect(timeline.textContent).toContain("approve_plan");
    expect(timeline.textContent).toContain("cto (dashboard)");
    expect(timeline.textContent).toContain("cto (slack)");
    expect(timeline.textContent).toContain("result.0.json");
    expect(timeline.textContent).toContain("result.1.json");
    expect(timeline.textContent).toContain("rehearsal.json");
    expect(screen.queryByText("A layout is waiting to be picked")).toBeNull();
  });

  it("shows the layout gate before and after keep_analyses", () => {
    const before = render(<RunView run={cutSampleRun(14)} source={sampleRunSource} />);
    expect(screen.getByRole("heading", { name: "A layout is waiting to be picked" })).toBeTruthy();
    before.unmount();

    render(<RunView run={cutSampleRun(15)} source={sampleRunSource} />);
    const banner = screen.getByRole("region", { name: "A layout is waiting to be picked" });
    expect(banner.textContent).toContain("keep_analyses");
    expect(banner.textContent).toContain("cto (dashboard)");
    expect(banner.textContent).toContain("idle-gpu-nodes");
    expect(banner.textContent).toContain("orphan-volumes");
  });

  it("shows the plan gate", () => {
    render(<RunView run={cutSampleRun(20)} source={sampleRunSource} />);
    expect(screen.getByRole("heading", { name: "The plan is waiting for approval" })).toBeTruthy();
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
    const source: RunSource = { eventsAfter: vi.fn().mockRejectedValue(new Error("offline")) };
    render(<RunView run={cutSampleRun(14)} source={source} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByRole("alert").textContent).toContain("offline");
    expect(screen.getByRole("region", { name: "demo-shop" })).toBeTruthy();
  });
});
