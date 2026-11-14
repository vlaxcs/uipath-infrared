import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalsPage } from "~/runs/ApprovalsPage";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";

afterEach(cleanup);

function sourceWith(overrides: Partial<RunSource>): RunSource {
  return { ...sampleRunSource, ...overrides };
}

const layout = { ...cutSampleRun(14), id: "run-approvals-0001" };
const plan = { ...cutSampleRun(20), id: "run-approvals-0002" };
const finished = { ...cutSampleRun(21), id: "run-approvals-0003" };

describe("the approvals page", () => {
  it("lists the waiting runs newest first and reviews one", async () => {
    const onReview = vi.fn();
    render(
      <ApprovalsPage
        source={sourceWith({ mode: "live", listRuns: async () => [layout, finished, plan] })}
        onReview={onReview}
      />,
    );

    const table = await screen.findByRole("table", { name: "Approvals" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("run-approvals-0002");
    expect(rows[0].textContent).toContain("Plan approval");
    expect(rows[0].textContent).toContain("rehearse");
    expect(rows[1].textContent).toContain("run-approvals-0001");
    expect(rows[1].textContent).toContain("Layout");
    expect(rows[1].textContent).toContain("present");

    fireEvent.click(within(rows[1]).getByRole("button", { name: "Review run-approvals-0001" }));
    expect(onReview).toHaveBeenCalledWith("run-approvals-0001");
  });

  it("says when nothing is waiting, with a note in sample mode", async () => {
    render(<ApprovalsPage source={sampleRunSource} onReview={vi.fn()} />);

    expect(await screen.findByText("No approvals waiting")).toBeTruthy();
    expect(screen.getByText(/Approvals need a live run/)).toBeTruthy();
  });

  it("shows a list error and retries", async () => {
    const listRuns = vi
      .fn()
      .mockRejectedValueOnce(new Error("orchestrator is offline"))
      .mockResolvedValueOnce([]);
    render(<ApprovalsPage source={sourceWith({ mode: "live", listRuns })} onReview={vi.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("orchestrator is offline");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No approvals waiting")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
