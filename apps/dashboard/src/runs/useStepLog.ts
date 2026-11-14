import { useEffect, useState } from "react";
import { RunSourceError, type RunSource } from "~/runs/source";
import type { RunStep } from "~/runs/types";

const POLL_MS = 1000;
const KEPT_CHARS = 200_000;

export type StepLogState = {
  status: "idle" | "loading" | "ready" | "not_started" | "error";
  text: string;
  running: boolean;
  error?: string;
};

export function useStepLog(source: RunSource, runId: string | null, step: RunStep | null, pollMs = POLL_MS): StepLogState {
  const [state, setState] = useState<StepLogState>({ status: "idle", text: "", running: false });

  useEffect(() => {
    if (!runId || !step) {
      setState({ status: "idle", text: "", running: false });
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    let next = 0;
    let text = "";
    const controller = new AbortController();
    setState({ status: "loading", text: "", running: false });

    const read = async () => {
      try {
        const chunk = await source.readLog(runId, step, next, controller.signal);
        if (cancelled) return;
        next = chunk.next;
        text = (text + chunk.text).slice(-KEPT_CHARS);
        setState({ status: "ready", text, running: chunk.running });
        if (chunk.running || chunk.text !== "") timer = window.setTimeout(read, chunk.text !== "" && !chunk.running ? 0 : pollMs);
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        if (cause instanceof RunSourceError && cause.status === 404) {
          setState({ status: "not_started", text: "", running: false });
          return;
        }
        setState({ status: "error", text, running: false, error: cause instanceof Error ? cause.message : String(cause) });
      }
    };

    void read();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [source, runId, step, pollMs]);

  return state;
}
