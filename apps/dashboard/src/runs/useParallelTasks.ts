import { useEffect, useMemo, useState } from "react";
import { parallelTasks, trialCount, type ParallelTask } from "~/runs/parallelTasks";
import type { RunSource } from "~/runs/source";
import type { RunDetail } from "~/runs/types";

const POLL_MS = 2000;

export type BesideThePipeline = { tasks: ParallelTask[]; trials: number };

export function useParallelTasks(source: RunSource, run: RunDetail, winner: string | null, pollMs = POLL_MS): BesideThePipeline {
  const [files, setFiles] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    source
      .listFiles(run.id, controller.signal)
      .then((list) => {
        setFiles(new Set(list.map((file) => file.path)));
        setNow(Date.now());
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [source, run.id, run.events.length, tick]);

  const tasks = useMemo(() => parallelTasks(run, winner, files, now), [run, winner, files, now]);
  const running = tasks.some((task) => task.state === "running");

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), pollMs);
    return () => window.clearTimeout(timer);
  }, [running, tick, pollMs]);

  const trials = useMemo(() => trialCount(files), [files]);
  return useMemo(() => ({ tasks, trials }), [tasks, trials]);
}
