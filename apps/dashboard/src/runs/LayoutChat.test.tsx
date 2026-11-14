import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisOption } from "~/runs/findings";
import { LayoutChat } from "~/runs/LayoutChat";
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
  decision: { kind: "keep_analyses", reason: "these stand", analyses: ["idle-gpu-nodes", "orphan-volumes"] },
};

function chat(overrides: Partial<Parameters<typeof LayoutChat>[0]> = {}) {
  return render(
    <LayoutChat
      options={options}
      analyses={analyses}
      analysesStatus="ready"
      onSubmit={vi.fn().mockResolvedValue(null)}
      busy={false}
      error={null}
      typingMs={0}
      {...overrides}
    />,
  );
}

function say(label: string, text: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("the layout chat", () => {
  it("asks which analyses to keep, then why, and sends keep_analyses", async () => {
    const onSubmit = vi.fn().mockResolvedValue(appended);
    chat({ onSubmit });

    expect(screen.getByText(/I found 3 problems in the estate/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /The GPU node group is idle/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /The ERP database waits/ }));
    fireEvent.click(screen.getByRole("button", { name: "Keep these" }));

    expect(screen.getByText("Keep 2 of 3.")).toBeTruthy();
    expect(screen.getByText("Why keep them?")).toBeTruthy();
    say("Reason for keeping", "these stand");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "keep_analyses", reason: "these stand", analyses: ["idle-gpu-nodes", "orphan-volumes"] },
    });
    expect(await screen.findByText(/I kept all 2 for the next plans/)).toBeTruthy();
    expect(screen.getByText("Which layout should I rehearse?")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /The GPU node group is idle/ }).closest("fieldset")?.disabled).toBe(true);
  });

  it("will not keep an empty selection", () => {
    chat();
    for (const analysis of analyses) fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(analysis.title) }));
    expect((screen.getByRole("button", { name: "Keep these" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("skips the analyses, picks the best layout by default and sends pick_layout", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    chat({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect((screen.getByRole("radio", { name: /consolidate/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Ruled out: do_nothing/)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /managed_services/ }));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(screen.getByText("Why this one?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "best payback that stays in the EU" }));
    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe("best payback that stays in the EU");
    say("Reason", "stays in the EU");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      step: "present",
      status: "approved",
      actor: { kind: "human", id: "cto", surface: "dashboard" },
      decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
    });
  });

  it("asks again when a reason was not accepted", async () => {
    chat({ onSubmit: vi.fn().mockResolvedValue(null) });
    fireEvent.click(screen.getByRole("button", { name: "Keep these" }));
    say("Reason for keeping", "these stand");
    expect(await screen.findByLabelText("Reason for keeping")).toBeTruthy();
  });

  it("types before it speaks", async () => {
    chat({ typingMs: 20 });
    expect(screen.getByRole("status", { name: "Typing" })).toBeTruthy();
    expect(await screen.findByText(/I found 3 problems/)).toBeTruthy();
  });

  it("goes straight to the layout when there is nothing to keep, and offers a retry when findings fail", () => {
    const onRetryAnalyses = vi.fn();
    const { unmount } = chat({ analyses: [], analysesStatus: "unavailable" });
    expect(screen.getByText("I have no analyses to keep this time.")).toBeTruthy();
    expect(screen.getByText("Which layout should I rehearse?")).toBeTruthy();
    unmount();

    chat({ analysesStatus: "error", analysesError: "boom", onRetryAnalyses });
    expect(screen.getByText(/I couldn't load the analyses: boom/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry analyses" }));
    expect(onRetryAnalyses).toHaveBeenCalledTimes(1);
  });

  it("keeps typing while the analyses load", () => {
    chat({ analysesStatus: "loading" });
    expect(screen.getByRole("status", { name: "Typing" })).toBeTruthy();
    expect(screen.queryByText(/I found/)).toBeNull();
  });

  it("says so when no layout is feasible", () => {
    chat({ options: [{ id: "do_nothing", feasible: false }], analyses: [], analysesStatus: "ready" });
    expect(screen.getByText(/None of the layouts passes the hard constraints/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose" })).toBeNull();
  });

  it("shows a conflict and offers a refresh", () => {
    const onRefresh = vi.fn();
    chat({ error: "This run has moved on.", onRefresh });
    expect(screen.getByRole("alert").textContent).toContain("moved on");
    fireEvent.click(screen.getByRole("button", { name: "Refresh run" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
