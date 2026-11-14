import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickLayoutDecision } from "~/runs/decisions";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError } from "~/runs/source";
import type { RunEvent } from "~/runs/types";
import { useSubmitDecision } from "~/runs/useSubmitDecision";

afterEach(cleanup);

const decision = pickLayoutDecision("managed_services", "stays in the EU");

const appended: RunEvent = {
  seq: 16,
  at: "2026-11-14T09:05:00Z",
  step: "present",
  status: "approved",
  revision: 1,
  actor: { kind: "human", id: "cto", surface: "dashboard" },
  decision: { kind: "pick_layout", reason: "stays in the EU", layout: "managed_services" },
};

describe("submitting a decision", () => {
  it("returns the appended event", async () => {
    const submitDecision = vi.fn().mockResolvedValue(appended);
    const { result } = renderHook(() =>
      useSubmitDecision({ ...sampleRunSource, submitDecision }, "run-1"),
    );

    let returned: RunEvent | null = null;
    await act(async () => {
      returned = await result.current.submit(decision);
    });

    expect(submitDecision).toHaveBeenCalledWith("run-1", decision);
    expect(returned).toEqual(appended);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("does nothing without a run", async () => {
    const submitDecision = vi.fn();
    const { result } = renderHook(() =>
      useSubmitDecision({ ...sampleRunSource, submitDecision }, null),
    );

    let returned: RunEvent | null = appended;
    await act(async () => {
      returned = await result.current.submit(decision);
    });

    expect(returned).toBeNull();
    expect(submitDecision).not.toHaveBeenCalled();
  });

  it("asks for a refresh when another surface decided first", async () => {
    const onConflict = vi.fn();
    const submitDecision = vi.fn().mockRejectedValue(new RunSourceError("stale gate", 409));
    const { result } = renderHook(() =>
      useSubmitDecision({ ...sampleRunSource, submitDecision }, "run-1", onConflict),
    );

    await act(async () => {
      await result.current.submit(decision);
    });

    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain("another surface may have decided");
  });

  it("explains an infeasible layout", async () => {
    const submitDecision = vi.fn().mockRejectedValue(new RunSourceError("infeasible", 422));
    const { result } = renderHook(() =>
      useSubmitDecision({ ...sampleRunSource, submitDecision }, "run-1"),
    );

    await act(async () => {
      await result.current.submit(decision);
    });

    expect(result.current.error).toContain("not feasible");
  });

  it("passes through other errors", async () => {
    const submitDecision = vi.fn().mockRejectedValue(new RunSourceError("gate is closed", 400));
    const { result } = renderHook(() =>
      useSubmitDecision({ ...sampleRunSource, submitDecision }, "run-1"),
    );

    await act(async () => {
      await result.current.submit(decision);
    });

    expect(result.current.error).toBe("gate is closed");
  });
});
