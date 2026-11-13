import { describe, it, expect } from 'vitest';
import { formatEvent, formatLayoutGate, formatPlanGate, formatRunHeader } from '../src/domain/messages.js';
import { candidatesOf } from '../src/domain/layout-choice.js';
import { summarize } from '../src/domain/run-summary.js';
import type { RunEvent } from '../src/domain/run.js';
import { afterLayoutEvent, sampleEvent, sampleRun } from './sample.js';

const text = (value: unknown) => JSON.stringify(value);

const keepAnalyses: RunEvent = {
  seq: 15,
  at: '2026-11-14T09:12:02Z',
  step: 'present',
  status: 'approved',
  revision: 1,
  actor: { kind: 'human', id: 'cto', surface: 'dashboard' },
  decision: { kind: 'keep_analyses', reason: 'the GPU and orphan findings stand', analyses: ['idle-gpu-nodes', 'orphan-volumes'] },
};

describe('Event messages', () => {
  it('posts nothing for a step that only started', () => {
    expect(formatEvent(sampleEvent(3))).toBeNull();
  });

  it('shows a revise decision on evaluate with its reason', () => {
    const message = text(formatEvent(sampleEvent(8)));
    expect(message).toContain('back to propose');
    expect(message).toContain('*Decision:* revise');
    expect(message).toContain('data_residency allows only eu-*');
    expect(message).toContain('result.0.json');
  });

  it('shows the revision an event belongs to', () => {
    expect(text(formatEvent(sampleEvent(12)))).toContain('revision 1');
    expect(text(formatEvent(sampleEvent(8)))).not.toContain('revision');
  });

  it('shows the rehearsal decision and its reason', () => {
    const message = text(formatEvent(afterLayoutEvent(19)));
    expect(message).toContain('The rehearsal held');
    expect(message).toContain('*Decision:* proceed');
    expect(message).toContain('the fallback took over');
  });

  it('names the person and the surface behind a decision at a gate', () => {
    expect(text(formatEvent(keepAnalyses))).toContain('cto (dashboard) kept the analyses idle-gpu-nodes, orphan-volumes');
  });

  it('offers a button per feasible architecture at the layout gate', () => {
    const candidates = candidatesOf(sampleEvent(14));
    const message = formatLayoutGate('run-demo-shop-0001', sampleEvent(14), candidates);
    const buttons = message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(button => button.action_id)).toEqual(['pick_layout_consolidate', 'pick_layout_managed_services', 'pick_layout_move_to_onprem']);
    expect(buttons.map(button => JSON.parse(button.value))).toEqual([
      { run_id: 'run-demo-shop-0001', seq: 14, layout: 'consolidate' },
      { run_id: 'run-demo-shop-0001', seq: 14, layout: 'managed_services' },
      { run_id: 'run-demo-shop-0001', seq: 14, layout: 'move_to_onprem' },
    ]);
    expect(text(message)).toContain('Which architecture should we migrate to');
    expect(text(message)).toContain('€74,365/mo');
    expect(text(message)).toContain('99.95% availability');
    expect(text(message)).toContain('Not offered (infeasible): rightsize_in_place, cleanup_orphans, do_nothing');
  });

  it('sends the layout pick to the dashboard when the gate carries no candidates', () => {
    const message = formatLayoutGate('run-demo-shop-0001', sampleEvent(14));
    expect(message.blocks.some(block => block.type === 'actions')).toBe(false);
    expect(text(message)).toContain('dashboard');
  });

  it('offers only the plan approval at the plan gate, carrying the run id', () => {
    const message = formatPlanGate('run-demo-shop-0001', afterLayoutEvent(20), afterLayoutEvent(19));
    const buttons = message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(button => button.action_id)).toEqual(['approve_plan']);
    expect(JSON.parse(buttons[0].value)).toEqual({ run_id: 'run-demo-shop-0001', seq: 20 });
    expect(text(message)).toContain('forecast traffic held');
  });

  it('summarises the run in the header', () => {
    const run = sampleRun();
    const message = text(formatRunHeader(run, summarize(run.events)));
    expect(message).toContain('run-demo-shop-0001');
    expect(message).toContain('awaiting approval (layout gate)');
    expect(message).toContain('1 of 2');
  });
});
