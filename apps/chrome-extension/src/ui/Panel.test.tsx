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
  it("leads with the monthly saving, then status and pipeline", () => {
    renderPanel();

    const hero = screen.getByRole("region", { name: "Monthly cost" });
    expect(within(hero).getByText("startup")).toBeTruthy();
    expect(within(hero).getByText("€1,496")).toBeTruthy();
    expect(within(hero).getByText("/mo saved")).toBeTruthy();
    expect(within(hero).getByText("−46%")).toBeTruthy();
    expect(within(hero).getByText("€3,269 → €1,773")).toBeTruthy();

    expect(screen.getByText("Awaiting layout")).toBeTruthy();
    const pipeline = screen.getByRole("list", { name: "Pipeline" });
    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByTitle("Present: Awaiting approval")).toBeTruthy();
  });

  it("leaves the run id, revision, layout names and captions to the dashboard", () => {
    renderPanel();

    expect(screen.queryByText("run-startup-0001")).toBeNull();
    expect(screen.queryByText(/revision/i)).toBeNull();
    expect(screen.queryByText(/agent-serverless-db-eu/)).toBeNull();
    expect(screen.queryByText(/managed_services/)).toBeNull();
    expect(screen.queryByText(/read-only/)).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("makes the waiting decision the one primary action", () => {
    renderPanel();

    const action = screen.getByRole("link", { name: "Review layout" }) as HTMLAnchorElement;
    expect(action.href).toBe("http://localhost:5173/#/runs/run-startup-0001");
    expect(action.className).toContain("ir-action-primary");
  });

  it("opens the dashboard when nothing waits on the user", () => {
    renderPanel({ run: latest({ status: "completed", step: "rehearse", awaiting: undefined }) });

    const action = screen.getByRole("link", { name: "Open dashboard" });
    expect(action.className).toContain("ir-action-secondary");
  });

  it("shows only the top runner suggestion and counts the rest", () => {
    renderPanel({
      run: latest({
        runners: [
          suggestion,
          { ...suggestion, id: "b", title: "Consider self-hosted or on-prem runners" },
          { ...suggestion, id: "c", title: "Check this metered runner type" },
        ],
      }),
    });

    const tip = screen.getByRole("region", { name: "Runner suggestion" });
    expect(within(tip).getByText("Move this workload to GitHub-hosted runners")).toBeTruthy();
    expect(tip.textContent).toContain("self-hosted");
    expect(tip.textContent).toContain("3 h/mo");
    expect(tip.textContent).toContain("+2 more");
    expect(screen.queryByText("Consider self-hosted or on-prem runners")).toBeNull();
    expect(screen.queryByText(suggestion.detail)).toBeNull();
  });

  it("drops the runner block when the run has no runner data", () => {
    renderPanel({ run: latest({ runners: [], runnerNote: "No GitHub Actions runner data in this run." }) });

    expect(screen.queryByRole("region", { name: "Runner suggestion" })).toBeNull();
    expect(screen.queryByText(/runner data/)).toBeNull();
  });

  it("wires refresh, settings and collapse as labelled icon buttons", () => {
    const { onRefresh, onOpenOptions, onToggleCollapsed } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse Infrared" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenOptions).toHaveBeenCalledTimes(1);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while a request is in flight", () => {
    renderPanel({ loading: true });
    expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("collapses to a pill that carries the saving", () => {
    const { onToggleCollapsed } = renderPanel({ collapsed: true });

    const pill = screen.getByRole("button", { name: "Open Infrared" });
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    expect(pill.textContent).toContain("−€1,496/mo");
    expect(screen.queryByRole("complementary", { name: "Infrared latest run" })).toBeNull();

    fireEvent.click(pill);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("falls back to the status in the pill when there is no saving", () => {
    renderPanel({ collapsed: true, run: latest({ before: null, after: null }) });
    expect(screen.getByRole("button", { name: "Open Infrared" }).textContent).toContain("Awaiting layout");
  });

  it("says when the run is not priced yet", () => {
    renderPanel({ run: latest({ before: null, after: null, winner: null, pickedLayout: undefined }) });
    expect(screen.getByText("Not priced yet")).toBeTruthy();
  });

  it("shows today's cost while there is no winner", () => {
    renderPanel({ run: latest({ after: null, winner: null }) });
    expect(screen.getByText("€3,269")).toBeTruthy();
    expect(screen.getByText("/mo today")).toBeTruthy();
  });

  it("says so when the winner saves nothing", () => {
    renderPanel({ run: latest({ before: 1000, after: 1200 }) });
    expect(screen.getByText("No saving")).toBeTruthy();
    expect(screen.getByText("€1,000 → €1,200")).toBeTruthy();
  });

  it("shows a loading state before the first response", () => {
    renderPanel({ run: null, loading: true });
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("shows a one-line notice and the dashboard link when there are no runs", () => {
    renderPanel({ run: null, notice: { kind: "no-runs", message: "No runs yet" } });

    expect(screen.getByRole("status").textContent).toContain("No runs yet");
    const link = screen.getByRole("link", { name: "Open dashboard" }) as HTMLAnchorElement;
    expect(link.href).toBe("http://localhost:5173/");
    expect(screen.queryByRole("region", { name: "Monthly cost" })).toBeNull();
    expect(screen.queryByText(/sample/i)).toBeNull();
  });

  it("keeps the cause of an unreachable orchestrator out of the way, in a tooltip", () => {
    renderPanel({
      run: null,
      notice: { kind: "unreachable", message: "Can't reach Infrared", detail: "Failed to fetch" },
    });

    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("Can't reach Infrared");
    expect(notice.textContent).not.toContain("Failed to fetch");
    expect(notice.getAttribute("title")).toBe("Failed to fetch");
    expect(screen.getByRole("link", { name: "Open dashboard" })).toBeTruthy();
  });

  it("sends the user to Settings when the extension has no access", () => {
    const { onOpenOptions } = renderPanel({
      run: null,
      notice: { kind: "no-access", message: "Not connected", detail: "No access to infrared.example.com." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onOpenOptions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Open dashboard" })).toBeNull();
  });

  it("puts a short notice label in the collapsed pill", () => {
    renderPanel({ collapsed: true, run: null, notice: { kind: "unreachable", message: "Can't reach Infrared" } });
    expect(screen.getByRole("button", { name: "Open Infrared" }).textContent).toContain("Offline");
  });
});
