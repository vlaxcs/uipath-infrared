import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import { RunsSection } from "~/runs/RunsSection";

afterEach(cleanup);

function sourceWith(overrides: Partial<RunSource>): RunSource {
  return { ...sampleRunSource, ...overrides };
}

describe("the runs section", () => {
  it("says when there are no runs", async () => {
    render(<RunsSection source={sourceWith({ listRuns: async () => [] })} />);
    expect(await screen.findByText("No runs yet")).toBeTruthy();
  });

  it("lists the sample run and opens it on selection", async () => {
    render(<RunsSection source={sampleRunSource} />);

    expect(await screen.findByRole("list", { name: "Runs" })).toBeTruthy();
    expect(screen.getByText("Select a run")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /run-demo-shop-0001/ }));

    const summary = await screen.findByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
  });

  it("selects the newest active run automatically", async () => {
    const active = cutSampleRun(14);
    render(
      <RunsSection
        source={sourceWith({
          listRuns: async () => [active],
          getRun: async () => active,
        })}
      />,
    );

    expect(await screen.findByRole("region", { name: "demo-shop" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "A layout is waiting to be picked" })).toBeTruthy();
  });

  it("starts a live run and follows it", async () => {
    const started = cutSampleRun(14);
    const startRun = vi.fn().mockResolvedValue(started);
    render(
      <RunsSection
        source={sourceWith({
          mode: "live",
          listRuns: async () => [],
          getRun: async () => started,
          startRun,
        })}
      />,
    );

    expect(await screen.findByText("No runs yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    await waitFor(() => expect(startRun).toHaveBeenCalledWith("startup"));
    expect(await screen.findByRole("region", { name: "demo-shop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start run" })).toBeNull();
  });

  it("shows a live list error and retries", async () => {
    const listRuns = vi
      .fn()
      .mockRejectedValueOnce(new Error("orchestrator is offline"))
      .mockResolvedValueOnce([]);
    render(<RunsSection source={sourceWith({ mode: "live", listRuns })} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("orchestrator is offline");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No runs yet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
