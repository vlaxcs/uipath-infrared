import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GateApproval } from "~/runs/GateApproval";
import type { LayoutOption, RunEvent } from "~/runs/types";

afterEach(cleanup);

const options: LayoutOption[] = [
  { id: "managed_services", feasible: true, rank: 2, monthly_eur: 1000, availability_pct: 99.95, risk: 0.18 },
  { id: "consolidate", feasible: true, rank: 1, monthly_eur: 900, availability_pct: 99.95, risk: 0.31 },
  { id: "do_nothing", feasible: false, availability_pct: 99.2 },
];

describe("the gate approval", () => {
  it("asks for the layout in the chat", () => {
    render(<GateApproval gate="layout" options={options} analyses={[]} analysesStatus="ready" onSubmit={vi.fn()} busy={false} error={null} />);
    expect(screen.getByRole("region", { name: "Layout decision" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve plan" })).toBeNull();
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

  it("disables the submit while busy", () => {
    render(<GateApproval gate="plan" options={[]} onSubmit={vi.fn()} busy error={null} />);
    const submit = screen.getByRole("button", { name: "Submitting…" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
