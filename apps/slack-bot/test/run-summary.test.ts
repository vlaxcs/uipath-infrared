import { describe, it, expect } from 'vitest';
import { summarize, withEvent } from '../src/domain/run-summary.js';
import { planApprovalFromSlack } from '../src/domain/plan-approval.js';
import { sampleRun } from './sample.js';

describe('Run summary', () => {
  it('agrees with the summary the sample run declares', () => {
    const { schema_version, id, project, max_revisions, inputs, events, ...declared } = sampleRun();
    expect(summarize(events)).toEqual(declared);
  });

  it('marks the run awaiting the layout gate after analyses are kept', () => {
    const events = sampleRun().events.filter(event => event.seq <= 15);
    expect(summarize(events)).toMatchObject({ status: 'awaiting_approval', awaiting: 'layout', revision: 1 });
  });

  it('completes the run when the plan is approved, with no open gate', () => {
    const run = sampleRun();
    const approved = { seq: 21, at: '2026-11-14T09:21:40Z', revision: 1, ...planApprovalFromSlack('andrei') };
    const finished = withEvent(run, approved);
    expect(finished.status).toBe('completed');
    expect(finished.finished_at).toBe('2026-11-14T09:21:40Z');
    expect(finished.updated_at).toBe('2026-11-14T09:21:40Z');
    expect(finished).not.toHaveProperty('awaiting');
    expect(finished.events.at(-1)).toEqual(approved);
  });

  it('fails the run on a failed event', () => {
    const events = [...sampleRun().events.slice(0, 7), {
      seq: 8, at: '2026-11-14T09:06:39Z', step: 'evaluate' as const, status: 'failed' as const, revision: 0,
      actor: { kind: 'orchestrator' as const }, decision: { kind: 'stop' as const, reason: 'no revision left' },
    }];
    expect(summarize(events)).toMatchObject({ status: 'failed', finished_at: '2026-11-14T09:06:39Z' });
  });
});
