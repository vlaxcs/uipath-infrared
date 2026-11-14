import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RunsTable } from "~/runs/RunsTable";
import type { RunSummary } from "~/runs/types";

afterEach(cleanup);

const run = (id: string, overrides: Partial<RunSummary>): RunSummary => ({
  id,
  project: "startup",
  status: "completed",
  step: "rehearse",
  revision: 1,
  max_revisions: 2,
  started_at: "2026-11-14T06:00:00Z",
  updated_at: "2026-11-14T06:05:00Z",
  ...overrides,
});

describe("the live run bar in Previous analysis", () => {
  it("shows where a running run is, and nothing under finished runs", () => {
    render(
      <RunsTable
        runs={[run("run-startup-0005", { status: "running", step: "propose" }), run("run-startup-0001", {})]}
        costs={{}}
        onOpenRun={() => {}}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "run-startup-0005 progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe("Step 3 of 6: Propose");
    expect([...bar.children].map((segment) => segment.getAttribute("data-step-state"))).toEqual(["done", "done", "current", "pending", "pending", "pending"]);
    expect(screen.queryByRole("progressbar", { name: "run-startup-0001 progress" })).toBeNull();
  });

  it("marks a run held at a gate as awaiting approval", () => {
    render(<RunsTable runs={[run("run-startup-0004", { status: "awaiting_approval", step: "present", awaiting: "layout" })]} costs={{}} onOpenRun={() => {}} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("Step 5 of 6: Present, awaiting approval");
    expect(bar.children[4].getAttribute("data-step-state")).toBe("awaiting");
  });
});
