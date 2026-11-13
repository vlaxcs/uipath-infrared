import { useEffect, useRef, useState } from "react";
import type { RunSource } from "~/runs/source";
import { deriveRunSummary, isTerminal } from "~/runs/summary";
import type { RunDetail, RunEvent } from "~/runs/types";

export type RunFeed = {
  run: RunDetail;
  error: string | null;
};

export function useRunFeed(run: RunDetail, source: RunSource, intervalMs = 2000): RunFeed {
  const [events, setEvents] = useState<RunEvent[]>(() => sortBySeq(run.events));
  const [error, setError] = useState<string | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    eventsRef.current = sortBySeq(run.events);
    setEvents(eventsRef.current);
    setError(null);

    if (isTerminal(deriveRunSummary(eventsRef.current).status)) return;

    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    const schedule = (delay: number) => {
      timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      controller = new AbortController();

      try {
        const incoming = await source.eventsAfter(run.id, highestSeq(eventsRef.current), controller.signal);
        if (cancelled) return;

        const fresh = sortBySeq(incoming).filter((event) => event.seq > highestSeq(eventsRef.current));
        if (fresh.length === 0) {
          setError(null);
          schedule(intervalMs);
          return;
        }

        const merged = sortBySeq([...eventsRef.current, ...fresh]);
        eventsRef.current = merged;
        setEvents(merged);
        setError(null);

        if (!isTerminal(deriveRunSummary(merged).status)) schedule(0);
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        schedule(intervalMs);
      }
    };

    schedule(intervalMs);

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [run.id, source, intervalMs]);

  const summary = deriveRunSummary(events);

  return {
    run: {
      ...run,
      status: summary.status,
      step: summary.step,
      revision: summary.revision,
      awaiting: summary.awaiting,
      started_at: summary.started_at,
      updated_at: summary.updated_at,
      finished_at: summary.finished_at,
      events,
    },
    error,
  };
}

function highestSeq(events: readonly RunEvent[]): number {
  return events.reduce((highest, event) => Math.max(highest, event.seq), 0);
}

function sortBySeq(events: readonly RunEvent[]): RunEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq);
}
