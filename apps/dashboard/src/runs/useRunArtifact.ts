import { useEffect, useRef, useState } from "react";
import { RunSourceError, type RunSource } from "~/runs/source";

export type ArtifactState = {
  status: "idle" | "loading" | "ready" | "unavailable" | "error";
  text?: string;
  error?: string;
};

export type ArtifactFeed = ArtifactState & { retry: () => void };

export function useRunArtifact(
  source: RunSource,
  runId: string | null,
  path: string | null,
): ArtifactFeed {
  const [state, setState] = useState<ArtifactState>({ status: "idle" });
  const [nonce, setNonce] = useState(0);
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!runId || !path) {
      setState({ status: "idle" });
      return;
    }

    const key = `${runId}:${path}`;
    const cached = cache.current.get(key);
    if (cached !== undefined) {
      setState({ status: "ready", text: cached });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });

    source
      .readArtifact(runId, path, controller.signal)
      .then((text) => {
        if (cancelled) return;
        cache.current.set(key, text);
        setState({ status: "ready", text });
      })
      .catch((cause) => {
        if (cancelled || controller.signal.aborted) return;
        if (cause instanceof RunSourceError && cause.status === 404) {
          setState({ status: "unavailable" });
          return;
        }
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : String(cause),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [source, runId, path, nonce]);

  return { ...state, retry: () => setNonce((current) => current + 1) };
}
