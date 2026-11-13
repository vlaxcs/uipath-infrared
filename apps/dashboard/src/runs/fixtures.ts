import { sampleRun } from "~/runs/sampleRun";
import { deriveRunSummary } from "~/runs/summary";
import type { RunDetail, RunEvent } from "~/runs/types";

const failedEvent: RunEvent = {
  seq: 8,
  at: "2026-11-14T09:06:40Z",
  step: "evaluate",
  status: "failed",
  revision: 0,
  actor: { kind: "orchestrator" },
  decision: { kind: "stop", reason: "the engine could not price the baseline" },
};

export function cutSampleRun(seq: number): RunDetail {
  const events = sampleRun.events.filter((event) => event.seq <= seq);
  return withDerivedSummary({ ...sampleRun, events });
}

export const failedRun: RunDetail = withDerivedSummary({
  ...sampleRun,
  id: "run-demo-shop-0002",
  project: "checkout",
  events: [...sampleRun.events.filter((event) => event.seq <= 7), failedEvent],
});

function withDerivedSummary(run: RunDetail): RunDetail {
  const summary = deriveRunSummary(run.events);

  return {
    ...run,
    status: summary.status,
    step: summary.step,
    revision: summary.revision,
    awaiting: summary.awaiting,
    started_at: summary.started_at,
    updated_at: summary.updated_at,
    finished_at: summary.finished_at,
    events: run.events,
  };
}
