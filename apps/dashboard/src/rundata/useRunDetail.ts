import { useEffect, useState } from "react";
import type { RunSource } from "~/runs/source";
import type { RunDetail } from "~/runs/types";

export type RunDetailState = {
  run: RunDetail | null;
  loading: boolean;
  error: string | null;
};

export function useRunDetail(source: RunSource, runId: string | null, version: string | null): RunDetailState {
  const [state, setState] = useState<RunDetailState>({ run: null, loading: false, error: null });

  useEffect(() => {
    if (!runId) {
      setState({ run: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState((current) => ({ run: current.run?.id === runId ? current.run : null, loading: true, error: null }));
    source
      .getRun(runId, controller.signal)
      .then((run) => {
        if (!cancelled) setState({ run, loading: false, error: null });
      })
      .catch((cause) => {
        if (cancelled || controller.signal.aborted) return;
        setState({ run: null, loading: false, error: cause instanceof Error ? cause.message : String(cause) });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [source, runId, version]);

  return state;
}
