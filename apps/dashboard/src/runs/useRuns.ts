import { useCallback, useEffect, useState } from "react";
import type { RunSource } from "~/runs/source";
import type { RunSummary } from "~/runs/types";

export type RunsFeed = {
  runs: RunSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useRuns(source: RunSource, intervalMs = 5000): RunsFeed {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    const load = async () => {
      controller = new AbortController();
      try {
        const next = await source.listRuns(controller.signal);
        if (cancelled) return;
        setRuns(next);
        setError(null);
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setError(messageOf(cause));
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (source.mode === "live") timer = window.setTimeout(load, intervalMs);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [source, intervalMs, nonce]);

  return { runs, loading, error, refresh };
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
