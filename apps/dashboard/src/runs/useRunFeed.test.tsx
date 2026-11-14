import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import type { RunSource } from "~/runs/source";
import type { RunEvent } from "~/runs/types";
import { useRunFeed } from "~/runs/useRunFeed";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const eventAt = (seq: number): RunEvent => sampleRun.events.find((event) => event.seq === seq)!;

function scriptedSource(...batches: RunEvent[][]): { calls: number[]; source: RunSource } {
  const calls: number[] = [];
  const queue = [...batches];

  return {
    calls,
    source: {
      ...sampleRunSource,
      eventsAfter: async (_runId, after) => {
        calls.push(after);
        return queue.shift() ?? [];
      },
    },
  };
}

describe("the run feed", () => {
  it("does not poll a finished run", async () => {
    vi.useFakeTimers();
    const { calls, source } = scriptedSource();
    renderHook(() => useRunFeed(sampleRun, source, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(calls).toEqual([]);
  });

  it("appends events after the last seq", async () => {
    vi.useFakeTimers();
    const { calls, source } = scriptedSource([eventAt(15)], [eventAt(16)]);
    const run = cutSampleRun(14);
    const { result } = renderHook(() => useRunFeed(run, source, 2000));

    expect(result.current.run.events).toHaveLength(14);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(calls).toEqual([14]);
    expect(result.current.run.events).toHaveLength(15);
    expect(result.current.run.awaiting).toBe("layout");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(calls).toEqual([14, 15]);
    expect(result.current.run.events).toHaveLength(16);
    expect(result.current.run.awaiting).toBeUndefined();
  });

  it("ignores stale events", async () => {
    vi.useFakeTimers();
    const { source } = scriptedSource([eventAt(14)]);
    const { result } = renderHook(() => useRunFeed(cutSampleRun(14), source, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.run.events).toHaveLength(14);
  });

  it("stops polling once the run completes", async () => {
    vi.useFakeTimers();
    const { calls, source } = scriptedSource([eventAt(21)]);
    const { result } = renderHook(() => useRunFeed(cutSampleRun(20), source, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.run.status).toBe("completed");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(calls).toEqual([20]);
  });

  it("keeps the events and retries when polling fails", async () => {
    vi.useFakeTimers();
    const eventsAfter = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    const source: RunSource = { ...sampleRunSource, eventsAfter };
    const { result } = renderHook(() => useRunFeed(cutSampleRun(14), source, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.error).toBe("offline");
    expect(result.current.run.events).toHaveLength(14);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.error).toBeNull();
  });

  it("aborts the request on unmount", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const source: RunSource = {
      ...sampleRunSource,
      eventsAfter: (_runId, _after, requestSignal) => {
        signal = requestSignal;
        return new Promise<RunEvent[]>(() => {});
      },
    };
    const { unmount } = renderHook(() => useRunFeed(cutSampleRun(14), source, 2000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("applies a batch once under StrictMode", async () => {
    vi.useFakeTimers();
    const { source } = scriptedSource([eventAt(15)]);
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useRunFeed(cutSampleRun(14), source, 2000), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.run.events).toHaveLength(15);
  });
});
