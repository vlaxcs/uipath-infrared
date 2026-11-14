import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatestRun, RunnerSuggestion, StepEntry } from "~/domain/types";
import { Panel } from "~/ui/Panel";

afterEach(cleanup);

const steps: StepEntry[] = [
  { step: "extract", state: "done" },
  { step: "investigate", state: "done" },
  { step: "propose", state: "done" },
  { step: "evaluate", state: "done" },
  { step: "present", state: "awaiting" },
  { step: "rehearse", state: "pending" },
];

const suggestion: RunnerSuggestion = {
  id: "move-to-hosted:self-hosted",
  title: "Move this workload to GitHub-hosted runners",
  detail: "Only 3 h/mo of self-hosted use; confirm the maintenance cost is buying something.",
  runnerType: "self-hosted",
  hours: 3,
  workflows: 8,
};

function latest(overrides: Partial<LatestRun> = {}): LatestRun {
  return {
    source: "live",
    id: "run-startup-0001",
    project: "startup",
    status: "awaiting_approval",
    step: "present",
    revision: 1,
    maxRevisions: 2,
    awaiting: "layout",
    updatedAt: "2026-11-14T09:12:00Z",
    before: 3269,
    after: 1773,
    winner: "agent-serverless-db-eu",
    pickedLayout: "managed_services",
    steps,
    runners: [suggestion],
    runnerSourceRepo: "vlaxcs/uipath-infrared",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof Panel>[0]> = {}) {
  const onToggleCollapsed = vi.fn();
  const onRefresh = vi.fn();
  const onOpenOptions = vi.fn();

  render(
    <Panel
      run={latest()}
      loading={false}
      collapsed={false}
      dashboardUrl="http://localhost:5173"
      onToggleCollapsed={onToggleCollapsed}
      onRefresh={onRefresh}
      onOpenOptions={onOpenOptions}
      {...overrides}
    />,
  );

  return { onToggleCollapsed, onRefresh, onOpenOptions };
}

describe("the Infrared panel", () => {
  it("shows the latest run, its prices, pipeline and runner suggestions", () => {
    renderPanel();

    expect(screen.getByRole("complementary", { name: "Infrared latest run" })).toBeTruthy();
    expect(screen.getByText("startup")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Awaiting layout")).toBeTruthy();
    expect(screen.getByText(/Present · revision 1\/2 · Layout/)).toBeTruthy();
    expect(screen.getByText("€3,269")).toBeTruthy();
    expect(screen.getByText("€1,773")).toBeTruthy();
    expect(screen.getByText("After (winner)")).toBeTruthy();
    expect(screen.getByText(/Winner:/).textContent).toContain("agent-serverless-db-eu");
    expect(screen.getByText(/Picked:/).textContent).toContain("managed_services");

    const pipeline = screen.getByRole("list", { name: "Pipeline" });
    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByTitle("Present: Awaiting approval")).toBeTruthy();
    expect(screen.getByTitle("Rehearse: Pending")).toBeTruthy();

    expect(screen.getByText("Move this workload to GitHub-hosted runners")).toBeTruthy();
    expect(screen.getByText("3 h/mo")).toBeTruthy();
    expect(screen.getByText("8 workflows")).toBeTruthy();
    expect(screen.getByText("self-hosted")).toBeTruthy();
    expect(screen.getByText("vlaxcs/uipath-infrared")).toBeTruthy();
    expect(screen.getByText(/excludes pricing and idle runner time/)).toBeTruthy();
    expect(screen.getByText(/read-only/)).toBeTruthy();
  });

  it("links to the dashboard and wires the footer actions", () => {
    const { onRefresh, onOpenOptions } = renderPanel();

    const link = screen.getByRole("link", { name: "Open dashboard" }) as HTMLAnchorElement;
    expect(link.href).toBe("http://localhost:5173/#/runs/run-startup-0001");

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenOptions).toHaveBeenCalledTimes(1);
  });

  it("collapses to a pill and expands again", () => {
    const { onToggleCollapsed } = renderPanel({ collapsed: true, run: latest() });

    const pill = screen.getByRole("button", { name: "Open Infrared" });
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("complementary", { name: "Infrared latest run" })).toBeNull();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("labels a sample fallback and shows its note", () => {
    renderPanel({
      run: latest({
        source: "sample",
        note: "Orchestrator unavailable (offline); showing sample data.",
        status: "completed",
        step: "rehearse",
        awaiting: undefined,
      }),
    });

    expect(screen.getByText("Sample data")).toBeTruthy();
    expect(screen.getByText(/Orchestrator unavailable/)).toBeTruthy();
  });

  it("explains when the run has no runner data", () => {
    renderPanel({
      run: latest({ runners: [], runnerSourceRepo: undefined, runnerNote: "No GitHub Actions runner data in this run." }),
    });

    expect(screen.getByText("No GitHub Actions runner data in this run.")).toBeTruthy();
  });

  it("says when the run is not priced yet", () => {
    renderPanel({ run: latest({ before: null, after: null, winner: null, pickedLayout: undefined }) });
    expect(screen.getByText("Not priced yet.")).toBeTruthy();
  });

  it("shows a loading state before the first response", () => {
    renderPanel({ run: null, loading: true, note: undefined });
    expect(screen.getByRole("status").textContent).toContain("Loading the latest run");
  });
});
