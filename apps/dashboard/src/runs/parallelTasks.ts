import type { RunDetail, RunStep } from "~/runs/types";

export const PLAN_BUILD_LIMIT_MS = 60_000;

export type ParallelTaskState = "running" | "done" | "failed";

export type ParallelTask = {
  id: string;
  label: string;
  beside: RunStep;
  file: string;
  candidate: string;
  state: ParallelTaskState;
};

type Fork = { revision: number; candidate: string; beside: RunStep; at: string };

export function parallelTasks(
  run: Pick<RunDetail, "events">,
  winner: string | null,
  files: ReadonlySet<string>,
  now: number,
): ParallelTask[] {
  const forks: Fork[] = [];
  let revision: number | null = null;
  for (const event of run.events) {
    if (event.step === "evaluate" && event.status === "completed") {
      revision = event.revision;
      if (winner) forks.push({ revision, candidate: winner, beside: "present", at: event.at });
    }
    const layout = event.decision?.kind === "pick_layout" ? event.decision.layout : undefined;
    if (layout && revision !== null && layout !== winner) {
      forks.push({ revision, candidate: layout, beside: "rehearse", at: event.at });
    }
  }

  const seen = new Set<string>();
  return forks.flatMap((fork) => {
    const file = `states.${fork.revision}.${fork.candidate}.json`;
    if (seen.has(file)) return [];
    seen.add(file);
    const started = Date.parse(fork.at);
    const state: ParallelTaskState = files.has(file)
      ? "done"
      : Number.isFinite(started) && now - started > PLAN_BUILD_LIMIT_MS
        ? "failed"
        : "running";
    return [{ id: file, label: `Migration plan · ${fork.candidate}`, beside: fork.beside, file, candidate: fork.candidate, state }];
  });
}

const TRIAL_FILE = /^rehearsal\.\d+\.trial-\d+\.json$/;

export function trialCount(files: ReadonlySet<string>): number {
  let count = 0;
  for (const file of files) if (TRIAL_FILE.test(file)) count += 1;
  return count;
}
