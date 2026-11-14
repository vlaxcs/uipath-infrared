import { useCallback, useEffect, useRef, useState } from "react";
import type { RunSource, TrialRequest } from "~/runs/source";

const POLL_MS = 2000;
const GIVE_UP_MS = 300_000;
const TRIAL_FILE = /^rehearsal\.(\d+)\.trial-(\d+)\.json$/;

export type Trial = { file: string; revision: number; number: number };

export type TrialsState = {
  trials: Trial[];
  pending: string | null;
  starting: boolean;
  error: string | null;
  start(trial: TrialRequest): Promise<void>;
};

export function trialsIn(paths: readonly string[]): Trial[] {
  return paths
    .flatMap((file) => {
      const match = TRIAL_FILE.exec(file);
      return match ? [{ file, revision: Number(match[1]), number: Number(match[2]) }] : [];
    })
    .sort((a, b) => b.revision - a.revision || b.number - a.number);
}

export function useTrials(source: RunSource, runId: string, pollMs = POLL_MS): TrialsState {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const files = await source.listFiles(runId, signal);
      const found = trialsIn(files.map((file) => file.path));
      setTrials(found);
      return found;
    },
    [source, runId],
  );

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const deadline = Date.now() + GIVE_UP_MS;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const found = await refresh(controller.signal);
        if (found.some((trial) => trial.file === pending)) {
          setPending(null);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (Date.now() > deadline) {
        setPending(null);
        setError(`${pending} did not appear after ${GIVE_UP_MS / 60_000} minutes. Check the orchestrator log.`);
        return;
      }
      timer = window.setTimeout(poll, pollMs);
    };
    timer = window.setTimeout(poll, pollMs);
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [pending, refresh, pollMs]);

  const start = useCallback(
    async (trial: TrialRequest) => {
      setStarting(true);
      setError(null);
      try {
        const started = await source.rehearse(runId, trial);
        if (mounted.current) setPending(started.file);
      } catch (cause) {
        if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (mounted.current) setStarting(false);
      }
    },
    [source, runId],
  );

  return { trials, pending, starting, error, start };
}
