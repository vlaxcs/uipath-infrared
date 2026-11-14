import { describe, it, expect } from 'vitest';
import { formatEvent, formatFailedRun, formatGateClosed, formatLayoutGate, formatPlanGate } from '../src/domain/messages.js';
import { candidatesOf, targetOf } from '../src/domain/layout-choice.js';
import { rehearsalOf } from '../src/domain/rehearsal-summary.js';
import { planOf } from '../src/domain/plan-summary.js';
import { PLAN_APPROVAL_VIEW, planApprovalView } from '../src/domain/approval-view.js';
import type { RunEvent } from '../src/domain/run.js';
import { afterLayoutEvent, sampleEvent } from './sample.js';

const text = (value: unknown) => JSON.stringify(value);
const RUN = 'run-demo-shop-0001';

const keepAnalyses: RunEvent = {
  seq: 15,
  at: '2026-11-14T09:12:02Z',
  step: 'present',
  status: 'approved',
  revision: 1,
  actor: { kind: 'human', id: 'cto', surface: 'dashboard' },
  decision: { kind: 'keep_analyses', reason: 'the GPU and orphan findings stand', analyses: ['idle-gpu-nodes', 'orphan-volumes'] },
};

const pickLayout: RunEvent = {
  seq: 16,
  at: '2026-11-14T09:12:30Z',
  step: 'present',
  status: 'approved',
  revision: 1,
  actor: { kind: 'human', id: 'andrei', surface: 'slack' },
  decision: { kind: 'pick_layout', reason: 'layout picked from Slack', layout: 'managed_services' },
};

const approvePlan: RunEvent = {
  seq: 20,
  at: '2026-11-14T09:29:00Z',
  step: 'rehearse',
  status: 'approved',
  revision: 1,
  actor: { kind: 'human', id: 'andrei', surface: 'slack' },
  decision: { kind: 'approve_plan', reason: 'looks good' },
};

describe('Event messages', () => {
  it('posts nothing for a step that only started', () => {
    expect(formatEvent(sampleEvent(3))).toBeNull();
  });

  it('shows a revise decision on evaluate with its reason', () => {
    const message = text(formatEvent(sampleEvent(8)));
    expect(message).toContain('goes back to Propose');
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
        expect(message).toContain('the fallback took over');
  });

  it('names the person and the surface behind a decision at a gate', () => {
    expect(text(formatEvent(keepAnalyses))).toContain('cto from dashboard kept the analyses idle-gpu-nodes, orphan-volumes');
  });
});

describe('Layout gate card', () => {
  it('recommends one architecture and shows the trade-off for the others', () => {
    const event = sampleEvent(14);
    const message = formatLayoutGate(RUN, event, candidatesOf(event), targetOf(event), { project: 'demo-shop' });
    const buttons = message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(button => button.action_id)).toEqual(['pick_layout_consolidate', 'pick_layout_managed_services', 'pick_layout_move_to_onprem']);
    expect(buttons[0].text.text).toBe('Rehearse consolidate');
    expect(buttons[0].style).toBe('primary');
    expect(buttons[1].text.text).toBe('Rehearse managed_services');
    expect(buttons[1].style).toBeUndefined();
    expect(JSON.parse(buttons[1].value)).toEqual({ run_id: RUN, seq: 14, layout: 'managed_services' });
    const shown = text(message);
    expect(shown).toContain('Which architecture should we run');
    expect(shown).toContain('The estate for demo-shop is extracted');
    expect(shown).toContain('3 options pass the hard constraints');
    expect(shown).toContain('*consolidate* — recommended');
    expect(shown).toContain('*Cost today*');
    expect(shown).toContain('€74,365 a month');
    expect(shown).toContain('€3.81M over 36 months');
    expect(shown).toContain('99.95%, you asked for 99.9%');
    expect(shown).toContain('*Effort*');
    expect(shown).toContain('794 hours of work');
    expect(shown).toContain('pays back in 1.38 months');
    expect(shown).toContain('Not picked: it carries more risk.');
    expect(shown).toContain("These can't run");
    expect(shown).toContain('rightsize_in_place, cleanup_orphans, do_nothing');
    expect(shown).toContain('min_availability_pct on rds-orders');
  });

  it('falls back to the dashboard notice when the gate carries no candidates', () => {
    const message = formatLayoutGate(RUN, sampleEvent(14));
    expect(message.blocks.some(block => block.type === 'actions')).toBe(false);
    expect(text(message)).toContain('dashboard');
  });

  it('adds a Details button when a dashboard URL is configured', () => {
    const event = sampleEvent(14);
    const message = formatLayoutGate(RUN, event, candidatesOf(event), targetOf(event), { dashboardUrl: 'https://infrared.local/runs/1' });
    const url = message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements).find(element => element.url);
    expect(url).toMatchObject({ text: { text: 'Details' }, url: 'https://infrared.local/runs/1' });
  });
});

describe('Plan gate card', () => {
  it('combines the rehearsal result and the plan being approved', () => {
    const event = afterLayoutEvent(20);
    const message = formatPlanGate(RUN, event, rehearsalOf(event), planOf(event), { project: 'demo-shop' });
    const buttons = message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(button => button.action_id)).toEqual(['approve_plan']);
    expect(JSON.parse(buttons[0].value)).toEqual({ run_id: RUN, seq: 20 });
    const shown = text(message);
    expect(shown).toContain('The rehearsal held — approve the plan?');
    expect(shown).toContain('99.92%');
    expect(shown).toContain(', you asked for 99.9%');
    expect(shown).toContain('*Result*');
    expect(shown).toContain('Held');
    expect(shown).toContain('stopped the primary database; the fallback took over');
    expect(shown).toContain('Latency p95');
    expect(shown).toContain('42 → 51 → 44 ms');
    expect(shown).toContain('The estate moves from €133,308 a month to €82,665 a month');
    expect(shown).toContain('514 hours of work');
    expect(shown).toContain('up to 2 hours of downtime');
    expect(shown).toContain('rds-orders: resize to db.r5.4xlarge');
  });

  it('falls back to the decision when the extensions are absent', () => {
    const message = formatPlanGate(RUN, afterLayoutEvent(20));
    expect(text(message)).toContain('Approving the plan completes the run');
  });
});

describe('Gate closed cards', () => {
  it('shows the picked architecture and what happens next', () => {
    const shown = text(formatGateClosed(pickLayout));
    expect(shown).toContain('The architecture is picked');
    expect(shown).toContain('andrei from slack picked the layout managed_services');
    expect(shown).toContain('the rehearsal runs on Floci');
  });

  it('shows who approved the plan and the note as the reason', () => {
    const shown = text(formatGateClosed(approvePlan, rehearsalOf(afterLayoutEvent(20))));
    expect(shown).toContain('The plan is approved');
    expect(shown).toContain('andrei from slack approved the plan');
    expect(shown).toContain('looks good');
    expect(shown).toContain('The run is complete');
    expect(shown).toContain('99.92%');
  });
});

describe('Failure card', () => {
  it('shows why the run stopped', () => {
    const failed: RunEvent = {
      seq: 9, at: '2026-11-14T09:06:39Z', step: 'evaluate', status: 'failed', revision: 1,
      actor: { kind: 'orchestrator' }, decision: { kind: 'stop', reason: 'three revisions without a feasible candidate' },
    };
    const shown = text(formatFailedRun(failed));
    expect(shown).toContain('Run stopped');
    expect(shown).toContain('three revisions without a feasible candidate');
  });
});

describe('Approval modal', () => {
  it('summarises the rehearsal and the plan and carries the run in private metadata', () => {
    const event = afterLayoutEvent(20);
    const view = planApprovalView(RUN, event, rehearsalOf(event), planOf(event), 'C1');
    expect(view.callback_id).toBe(PLAN_APPROVAL_VIEW);
    expect(JSON.parse(view.private_metadata)).toEqual({ run_id: RUN, seq: 20, channel_id: 'C1' });
    expect(view.submit.text).toBe('Approve');
    expect(text(view)).toContain('99.92%');
    expect(text(view)).toContain('Result: Held');
    expect(text(view)).toContain('The estate moves from €133,308 a month to €82,665 a month');
    expect(view.blocks.some((block: any) => block.type === 'input' && block.block_id === 'note')).toBe(true);
  });
});

describe('Placeholders', () => {
  it('writes a placeholder when a rich candidate is missing a value', () => {
    const event = sampleEvent(14);
    const candidates = candidatesOf(event).map(candidate =>
      candidate.id === 'consolidate' ? { ...candidate, horizonEur: undefined, risk: undefined, actions: undefined } : candidate
    );
    const shown = text(formatLayoutGate(RUN, event, candidates, targetOf(event)));
    expect(shown).toContain('*Over the horizon*\\nnot estimated');
    expect(shown).toContain('*Risk score*\\nnot estimated');
    expect(shown).toContain('*Changes*\\nnot estimated');
    expect(shown).toContain('*Cost today*');
  });

  it('writes a placeholder when the rehearsal summary is partial', () => {
    const event = { ...afterLayoutEvent(20), x_rehearsal: { passed: true } } as RunEvent;
    const shown = text(formatPlanGate(RUN, event, rehearsalOf(event), planOf(event)));
    expect(shown).toContain('*Availability*\\nnot measured');
    expect(shown).toContain('*Latency p95*\\nnot measured');
    expect(shown).toContain('*Result*\\nHeld');
  });
});
