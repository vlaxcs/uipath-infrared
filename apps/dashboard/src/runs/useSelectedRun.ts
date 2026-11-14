import { useEffect, useRef, useState } from "react";
import type { RunSource } from "~/runs/source";
import type { RunDetail } from "~/runs/types";

export type SelectedRunFeed = {
  run: RunDetail | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useSelectedRun(source: RunSource, id: string | null): SelectedRunFeed {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!id) {
      setRun(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    if (shown.current !== id) {
      setRun(null);
      setLoading(true);
    }
    setError(null);

    source
      .getRun(id, controller.signal)
      .then((next) => {
        if (cancelled) return;
        shown.current = id;
        setRun(next);
        setLoading(false);
      })
      .catch((cause) => {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [source, id, nonce]);

  return { run, loading, error, reload: () => setNonce((current) => current + 1) };
}
