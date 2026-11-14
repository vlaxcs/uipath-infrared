import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError } from "~/runs/source";
import { useRunArtifact } from "~/runs/useRunArtifact";

afterEach(cleanup);

describe("loading a run artifact", () => {
  it("stays idle without a run or path", () => {
    const readArtifact = vi.fn();
    const source = { ...sampleRunSource, readArtifact };
    const { result } = renderHook(() => useRunArtifact(source, "run-1", null));

    expect(result.current.status).toBe("idle");
    expect(readArtifact).not.toHaveBeenCalled();
  });

  it("reads a path once and caches it", async () => {
    const readArtifact = vi.fn().mockResolvedValue('{"components":[]}');
    const source = { ...sampleRunSource, readArtifact };
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useRunArtifact(source, "run-1", path),
      { initialProps: { path: "infra.json" } },
    );

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.text).toBe('{"components":[]}');

    rerender({ path: "infra.json" });
    expect(readArtifact).toHaveBeenCalledTimes(1);
  });

  it("marks a missing file as unavailable", async () => {
    const readArtifact = vi.fn().mockRejectedValue(new RunSourceError("not found", 404));
    const source = { ...sampleRunSource, readArtifact };
    const { result } = renderHook(() => useRunArtifact(source, "run-1", "infra.json"));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("shows an error and retries", async () => {
    const readArtifact = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("{}");
    const source = { ...sampleRunSource, readArtifact };
    const { result } = renderHook(() => useRunArtifact(source, "run-1", "infra.json"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("offline");

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(readArtifact).toHaveBeenCalledTimes(2);
  });

  it("aborts the read on unmount", async () => {
    let signal: AbortSignal | undefined;
    const readArtifact = vi.fn((_id: string, _path: string, requestSignal?: AbortSignal) => {
      signal = requestSignal;
      return new Promise<string>(() => {});
    });
    const source = { ...sampleRunSource, readArtifact };
    const { unmount } = renderHook(() => useRunArtifact(source, "run-1", "infra.json"));

    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
