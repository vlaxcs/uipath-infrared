import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import { RunsSection } from "~/runs/RunsSection";

afterEach(cleanup);

function sourceWith(overrides: Partial<RunSource>): RunSource {
  return { ...sampleRunSource, ...overrides };
}

function Harness({ source, initialRunId = null }: { source: RunSource; initialRunId?: string | null }) {
  const [runId, setRunId] = useState<string | null>(initialRunId);

  return (
    <RunsSection
      source={source}
      runId={runId}
      onOpenRun={setRunId}
      onCloseRun={() => setRunId(null)}
    />
  );
}

describe("the runs section", () => {
  it("says when there are no runs", async () => {
    render(<Harness source={sourceWith({ listRuns: async () => [] })} />);
    expect(await screen.findByText("No runs yet")).toBeTruthy();
  });

  it("lists runs in a table with before and after prices, then opens a separate run page", async () => {
    render(<Harness source={sampleRunSource} />);

    const table = await screen.findByRole("table", { name: "Runs" });
    expect(table.textContent).toContain("Before €/mo");
    expect(table.textContent).toContain("After €/mo");
    expect(await screen.findByText("€133,308")).toBeTruthy();
    expect(screen.getByText("€74,365")).toBeTruthy();
    expect(screen.getByText("consolidate")).toBeTruthy();

    fireEvent.click(within(table).getByRole("button", { name: /run-demo-shop-0001/ }));

    const summary = await screen.findByRole("region", { name: "demo-shop" });
    expect(summary.textContent).toContain("Completed");
    expect(screen.queryByRole("table", { name: "Runs" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Run overview" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /All runs/ }));

    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "demo-shop" })).toBeNull();
  });

  it("opens the active run from the start panel", async () => {
    const active = cutSampleRun(14);
    render(
      <Harness
        source={sourceWith({
          mode: "live",
          listRuns: async () => [active],
          getRun: async () => active,
        })}
      />,
    );

    expect(await screen.findByRole("table", { name: "Runs" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View active run" }));

    expect(await screen.findByRole("region", { name: "demo-shop" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "A layout is waiting to be picked" })).toBeTruthy();
  });

  it("starts a live run and navigates to its page", async () => {
    const started = cutSampleRun(14);
    const startRun = vi.fn().mockResolvedValue(started);
    render(
      <Harness
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
    expect(screen.getByRole("button", { name: /All runs/ })).toBeTruthy();
  });

  it("shows a live list error and retries", async () => {
    const listRuns = vi
      .fn()
      .mockRejectedValueOnce(new Error("orchestrator is offline"))
      .mockResolvedValueOnce([]);
    render(<Harness source={sourceWith({ mode: "live", listRuns })} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("orchestrator is offline");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No runs yet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
