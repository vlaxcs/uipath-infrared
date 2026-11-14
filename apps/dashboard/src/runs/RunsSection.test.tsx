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

function Harness({
  source,
  initialRunId = null,
  focusGate = false,
}: {
  source: RunSource;
  initialRunId?: string | null;
  focusGate?: boolean;
}) {
  const [runId, setRunId] = useState<string | null>(initialRunId);

  return (
    <RunsSection
      source={source}
      runId={runId}
      focusGate={focusGate}
      onOpenRun={setRunId}
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

    const summary = await screen.findByRole("group", { name: "Run status" });
    expect(summary.textContent).toContain("Completed");
    expect(screen.queryByRole("table", { name: "Runs" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a run with its gate already pinned", async () => {
    const waiting = { ...cutSampleRun(14), id: "run-approvals-0001" };
    render(
      <Harness
        source={sourceWith({ getRun: async () => waiting })}
        initialRunId={waiting.id}
        focusGate
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Present" })).toBeTruthy();
    expect(await screen.findByText(/Which should I keep for the next plans/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
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

    expect(await screen.findByRole("group", { name: "Run status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick a layout" })).toBeTruthy();
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
    expect(await screen.findByRole("group", { name: "Run status" })).toBeTruthy();
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
