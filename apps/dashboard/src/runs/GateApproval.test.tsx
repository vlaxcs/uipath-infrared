import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GateApproval } from "~/runs/GateApproval";
import type { AnalysisOption } from "~/runs/findings";
import type { LayoutOption, RunEvent } from "~/runs/types";

afterEach(cleanup);

const options: LayoutOption[] = [
  { id: "managed_services", feasible: true, rank: 2, monthly_eur: 1000, availability_pct: 99.95, risk: 0.18 },
  { id: "consolidate", feasible: true, rank: 1, monthly_eur: 900, availability_pct: 99.95, risk: 0.31 },
  { id: "do_nothing", feasible: false, availability_pct: 99.2 },
];

const analyses: AnalysisOption[] = [
  { id: "idle-gpu-nodes", title: "The GPU node group is idle", category: "delete_idle", risk: "low" },
  { id: "orphan-volumes", title: "Six EBS volumes are unattached", category: "storage_tiering", risk: "low" },
  { id: "erp-residency", title: "The ERP database waits for the vendor", category: "migrate", risk: "medium" },
];

const appended: RunEvent = {
  seq: 15,
  at: "2026-11-14T09:05:00Z",
  step: "present",
  status: "approved",
  revision: 1,
  actor: { kind: "human", id: "cto", surface: "dashboard" },
  decision: {
    kind: "keep_analyses",
    reason: "these stand",
    analyses: ["idle-gpu-nodes", "orphan-volumes"],
  },
};

describe("the gate approval form", () => {
  it("preselects the best feasible layout and submits a pick_layout decision", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<GateApproval gate="layout" options={options} onSubmit={onSubmit} busy={false} error={null} />);

    const best = screen.getByRole("radio", { name: /consolidate/ }) as HTMLInputElement;
    expect(best.checked).toBe(true);
    expect(screen.getByText(/Infeasible: do_nothing/)).toBeTruthy();

    const submit = screen.getByRole("button", { name: "Pick layout" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "stays in the EU" } });
    fireEvent.click(screen.getByRole("radio", { name: /managed_services/ }));
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
    });
  });

  it("keeps the selected analyses and leaves the layout choice open", async () => {
    const onSubmit = vi.fn().mockResolvedValue(appended);
    render(
      <GateApproval
        gate="layout"
        options={options}
        analyses={analyses}
        analysesStatus="ready"
        onSubmit={onSubmit}
        busy={false}
        error={null}
      />,
    );

    expect((screen.getByRole("checkbox", { name: /The GPU node group is idle/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole("checkbox", { name: /Six EBS volumes/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /The ERP database waits/ }));
    const keep = screen.getByRole("button", { name: "Keep selected analyses" }) as HTMLButtonElement;
    expect(keep.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for keeping"), { target: { value: "these stand" } });
    fireEvent.click(keep);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: {
        kind: "keep_analyses",
        reason: "these stand",
        analyses: ["idle-gpu-nodes", "orphan-volumes"],
      },
    });
    expect(screen.getByRole("status").textContent).toContain("Kept 2 analyses");
    expect((screen.getByLabelText("Reason for keeping") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Pick layout" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Keep selected analyses" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("requires at least one analysis to keep", () => {
    render(
      <GateApproval
        gate="layout"
        options={options}
        analyses={analyses}
        analysesStatus="ready"
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );

    for (const analysis of analyses) {
      fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(analysis.title) }));
    }
    fireEvent.change(screen.getByLabelText("Reason for keeping"), { target: { value: "why" } });
    expect((screen.getByRole("button", { name: "Keep selected analyses" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps analyses even when no layout is feasible", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(
      <GateApproval
        gate="layout"
        options={[{ id: "do_nothing", feasible: false }]}
        analyses={analyses}
        analysesStatus="ready"
        onSubmit={onSubmit}
        busy={false}
        error={null}
      />,
    );

    expect(screen.getByText(/No feasible layout is available/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason for keeping"), { target: { value: "these stand" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep selected analyses" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("explains when findings are loading, unavailable or empty", () => {
    const onRetryAnalyses = vi.fn();
    const props = {
      gate: "layout" as const,
      options,
      onSubmit: vi.fn(),
      busy: false,
      error: null,
    };

    const { unmount } = render(<GateApproval {...props} analyses={analyses} analysesStatus="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Loading analyses");
    unmount();

    const next = render(
      <GateApproval
        {...props}
        analyses={[]}
        analysesStatus="unavailable"
        onRetryAnalyses={onRetryAnalyses}
      />,
    );
    expect(screen.getByText("Findings are unavailable; you can still pick a layout.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry analyses" }));
    expect(onRetryAnalyses).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Pick layout" })).toBeTruthy();
    next.unmount();

    render(<GateApproval {...props} analyses={[]} analysesStatus="ready" />);
    expect(screen.getByText("No analyses to keep; pick a layout.")).toBeTruthy();
  });

  it("does not show keep analyses on the plan gate", () => {
    render(
      <GateApproval
        gate="plan"
        options={[]}
        analyses={analyses}
        analysesStatus="ready"
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );

    expect(screen.queryByText("Keep analyses")).toBeNull();
    expect(screen.queryByLabelText("Reason for keeping")).toBeNull();
  });

  it("offers a suggested reason", () => {
    render(
      <GateApproval gate="layout" options={options} onSubmit={vi.fn()} busy={false} error={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use suggested reason" }));
    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe(
      "best payback that stays in the EU",
    );
  });

  it("explains when no layout is feasible", () => {
    render(
      <GateApproval
        gate="layout"
        options={[{ id: "do_nothing", feasible: false }]}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );

    expect(screen.getByText(/No feasible layout is available/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Pick layout" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("approves the plan with a reason", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<GateApproval gate="plan" options={[]} onSubmit={onSubmit} busy={false} error={null} />);

    expect(screen.getByText("Approve the plan")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "rehearsal held" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve plan" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      step: "rehearse",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "approve_plan", reason: "rehearsal held" },
    });
  });

  it("shows a conflict and offers a refresh", () => {
    const onRefresh = vi.fn();
    render(
      <GateApproval
        gate="layout"
        options={options}
        onSubmit={vi.fn()}
        busy={false}
        error="This run has moved on."
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("moved on");
    fireEvent.click(screen.getByRole("button", { name: "Refresh run" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables the submit while busy", () => {
    render(<GateApproval gate="plan" options={[]} onSubmit={vi.fn()} busy error={null} />);
    const submit = screen.getByRole("button", { name: "Submitting…" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
