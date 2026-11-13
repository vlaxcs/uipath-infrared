import type { Gate, Run, RunEvent, RunStatus, RunSummary } from './run.js';

export function summarize(events: RunEvent[]): RunSummary {
  const first = events[0];
  const last = events[events.length - 1];
  const { status, awaiting } = statusOf(last);
  const summary: RunSummary = {
    status,
    step: last.step,
    revision: events.filter(event => event.decision?.kind === 'revise').length,
    started_at: first.at,
    updated_at: last.at,
  };
  if (awaiting) summary.awaiting = awaiting;
  if (isFinished(status)) summary.finished_at = last.at;
  return summary;
}

export function withEvent(run: Run, event: RunEvent): Run {
  const events = [...run.events, event];
  const { awaiting, finished_at, ...rest } = run;
  return { ...rest, ...summarize(events), events };
}

export function isFinished(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function statusOf(last: RunEvent): { status: RunStatus; awaiting?: Gate } {
  const kind = last.decision?.kind;
  if (last.status === 'failed') return { status: 'failed' };
  if (kind === 'approve_plan') return { status: 'completed' };
  if (last.status === 'awaiting_approval' && last.gate) return { status: 'awaiting_approval', awaiting: last.gate };
  if (kind === 'keep_analyses') return { status: 'awaiting_approval', awaiting: 'layout' };
  return { status: 'running' };
}
