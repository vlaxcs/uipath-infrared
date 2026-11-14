import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import result from "../../../../contracts/result.example.json";
import { cutSampleRun } from "~/runs/fixtures";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError, type RunSource } from "~/runs/source";
import { useRunCosts } from "~/runs/useRunCosts";

afterEach(cleanup);

function sourceWith(overrides: Partial<RunSource>): RunSource {
  return { ...sampleRunSource, ...overrides };
}

describe("the run costs", () => {
  it("loads the latest result and exposes its before and after prices", async () => {
    const listFiles = vi.fn().mockResolvedValue([
      { path: "infra.json", size: 1 },
      { path: "result.1.json", size: 1 },
    ]);
    const readArtifact = vi.fn().mockResolvedValue(JSON.stringify(result));
    const run = cutSampleRun(14);
    const source = sourceWith({ listFiles, readArtifact });
    const { result: costs } = renderHook(() => useRunCosts(source, [run]));

    await waitFor(() =>
      expect(costs.current[run.id]).toEqual({ before: 133308, after: 74365, winner: "consolidate" }),
    );
    expect(listFiles).toHaveBeenCalledWith(run.id, expect.any(AbortSignal));
    expect(readArtifact).toHaveBeenCalledWith(run.id, "result.1.json", expect.any(AbortSignal));
  });

  it("falls back to empty prices when the file API is missing", async () => {
    const source = sourceWith({
      listFiles: vi.fn().mockRejectedValue(new RunSourceError("not found", 404)),
    });
    const run = cutSampleRun(14);
    const { result: costs } = renderHook(() => useRunCosts(source, [run]));

    await waitFor(() => expect(costs.current[run.id]).toEqual({ before: null, after: null, winner: null }));
  });

  it("does not refetch an unchanged run", async () => {
    const listFiles = vi.fn().mockResolvedValue([]);
    const source = sourceWith({ listFiles });
    const run = cutSampleRun(14);
    const { rerender } = renderHook(({ runs }) => useRunCosts(source, runs), {
      initialProps: { runs: [run] },
    });

    await waitFor(() => expect(listFiles).toHaveBeenCalledTimes(1));
    act(() => rerender({ runs: [{ ...run }] }));
    expect(listFiles).toHaveBeenCalledTimes(1);
  });
});
