import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GateApproval } from "~/runs/GateApproval";
import type { LayoutOption } from "~/runs/types";

afterEach(cleanup);

const options: LayoutOption[] = [
  { id: "managed_services", feasible: true, rank: 2, monthly_eur: 1000, availability_pct: 99.95, risk: 0.18 },
  { id: "consolidate", feasible: true, rank: 1, monthly_eur: 900, availability_pct: 99.95, risk: 0.31 },
  { id: "do_nothing", feasible: false, availability_pct: 99.2 },
];

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
