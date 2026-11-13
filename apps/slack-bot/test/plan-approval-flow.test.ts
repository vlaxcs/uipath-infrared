import { describe, it, expect } from 'vitest';
import { FakeSlackClient } from '../src/adapters/slack.js';
import { SampleOrchestrator } from '../src/adapters/sample-orchestrator.js';
import { RunTracker } from '../src/application/run-tracker.js';
import { PlanApprover } from '../src/application/plan-approver.js';
import { LayoutPicker } from '../src/application/layout-picker.js';
import { approvePlanAction } from '../src/entry/plan-action.js';
import { pickLayoutAction } from '../src/entry/layout-action.js';
import { summarize } from '../src/domain/run-summary.js';
import type { Run, RunSummary } from '../src/domain/run.js';
import { afterLayoutEvents, sampleRun } from './sample.js';

const RUN = 'run-demo-shop-0001';
const CLICKED_AT = new Date('2026-11-14T09:25:00.123Z');
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

async function until(condition: () => boolean) {
  for (let i = 0; i < 1000 && !condition(); i++) await tick();
  if (!condition()) throw new Error('condition never held');
}

function startRun() {
  const orchestrator = new SampleOrchestrator(sampleRun(), afterLayoutEvents(), tick, 0, () => CLICKED_AT);
  const slack = new FakeSlackClient();
  let summary: RunSummary | undefined;
  const tracking = new RunTracker(slack, orchestrator, 'infrared-runs', tick, 0).track(RUN).then(done => { summary = done; });
  const ephemeral: any[] = [];
  const client = { chat: { postEphemeral: async (args: any) => { ephemeral.push(args); } } };
  const button = (messageText: string, actionId: string, matches: (value: any) => boolean) => {
    const posted = slack.messages.find(message => message.message.text === messageText)!;
    return posted.message.blocks
      .filter(block => block.type === 'actions')
      .flatMap(block => block.elements)
      .find(element => (element.action_id === actionId || element.action_id.startsWith(`${actionId}_`)) && matches(JSON.parse(element.value)));
  };
  const runAction = (handler: any, value: object, user = { id: 'U1', name: 'andrei' }) =>
    handler({ body: { actions: [{ value: JSON.stringify(value) }], user, channel: { id: 'C1' } }, ack: async () => {}, client });
  const clickLayout = (layout: string, user?: { id: string; name: string }) =>
    runAction(pickLayoutAction(new LayoutPicker(orchestrator)), JSON.parse(button('A layout is waiting to be picked', 'pick_layout', value => value.layout === layout)!.value), user);
  const clickPlan = (user?: { id: string; name: string }) =>
    runAction(approvePlanAction(new PlanApprover(orchestrator)), JSON.parse(button('The plan is waiting for approval', 'approve_plan', () => true)!.value), user);
  const layoutPosted = () => slack.messages.some(posted => posted.message.text === 'A layout is waiting to be picked');
  const planPosted = () => slack.messages.some(posted => posted.message.text === 'The plan is waiting for approval');
  return {
    orchestrator,
    slack,
    tracking,
    clickLayout,
    clickPlan,
    runAction,
    ephemeral,
    layoutPosted,
    planPosted,
    summary: (): RunSummary | undefined => summary,
  };
}

describe('Slack gates', () => {
  it('pauses at the layout gate and offers the feasible architectures', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    for (let i = 0; i < 50; i++) await tick();

    expect(flow.summary()).toBeUndefined();
    expect(flow.orchestrator.document()).toMatchObject({ status: 'awaiting_approval', awaiting: 'layout', step: 'present' });
    expect(flow.orchestrator.document().events).toHaveLength(14);
    const posted = flow.slack.messages.find(message => message.message.text === 'A layout is waiting to be picked')!;
    const buttons = posted.message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(element => JSON.parse(element.value).layout)).toEqual(['consolidate', 'managed_services', 'move_to_onprem']);
  });

  it('does not continue to the rehearsal until an architecture is picked', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    for (let i = 0; i < 100; i++) await tick();

    expect(flow.planPosted()).toBe(false);
    expect(flow.orchestrator.document().events).toHaveLength(14);
  });

  it('records the architecture picked from Slack and continues the loop', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    const layoutTs = flow.slack.messages.find(message => message.message.text === 'A layout is waiting to be picked')!.timestamp;
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);

    const run = flow.orchestrator.document();
    expect(run.events[14]).toEqual({
      seq: 15,
      at: '2026-11-14T09:25:00Z',
      step: 'present',
      status: 'approved',
      revision: 1,
      actor: { kind: 'human', id: 'andrei', surface: 'slack' },
      decision: { kind: 'pick_layout', reason: 'layout picked from Slack', layout: 'managed_services' },
    });
    expect(run).toMatchObject({ status: 'awaiting_approval', awaiting: 'plan', step: 'rehearse' });
    expect(run.events).toHaveLength(19);
    expect(run.events.at(-1)).toMatchObject({ seq: 19, gate: 'plan' });

    const update = flow.slack.updates.find(updated => updated.timestamp === layoutTs)!;
    const shown = JSON.stringify(update.message);
    expect(update.message.blocks.some(block => block.type === 'actions')).toBe(false);
    expect(shown).toContain('Layout picked');
    expect(shown).toContain('andrei (slack) picked the layout managed_services');
  });

  it('completes the run when the plan is approved after the architecture pick', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    await flow.clickPlan();
    await flow.tracking;

    const run = flow.orchestrator.document();
    expect(run.events).toHaveLength(20);
    expect(run.events.at(-1)).toEqual({
      seq: 20,
      at: '2026-11-14T09:25:00Z',
      step: 'rehearse',
      status: 'approved',
      revision: 1,
      actor: { kind: 'human', id: 'andrei', surface: 'slack' },
      decision: { kind: 'approve_plan', reason: 'rehearsal held; plan approved from Slack' },
    });
    expect(run.events.map(event => event.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(run).toMatchObject({ status: 'completed', finished_at: '2026-11-14T09:25:00Z', updated_at: '2026-11-14T09:25:00Z' });
    expect(run).not.toHaveProperty('awaiting');
    const { schema_version, id, project, max_revisions, inputs, events, ...declared } = run;
    expect(declared).toEqual(summarize(events));
    expect(flow.summary()?.status).toBe('completed');
  });

  it('refuses a plan approval at the layout gate and tells the person', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.runAction(approvePlanAction(new PlanApprover(flow.orchestrator)), { run_id: RUN, seq: 14 });

    expect(flow.orchestrator.document().events).toHaveLength(14);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0].text).toContain('waiting for a layout choice');
  });

  it('refuses an architecture the result did not offer', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.runAction(pickLayoutAction(new LayoutPicker(flow.orchestrator)), { run_id: RUN, seq: 14, layout: 'do_nothing' });

    expect(flow.orchestrator.document().events).toHaveLength(14);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0].text).toContain('layout do_nothing is not offered');
  });

  it('never dates an event before the event it follows', async () => {
    const orchestrator = new SampleOrchestrator(sampleRun(), afterLayoutEvents(), tick, 0, () => new Date('2026-11-13T12:00:00Z'));
    for (let i = 0; i < 14; i++) await orchestrator.eventsAfter(RUN, i);

    const picked = await new LayoutPicker(orchestrator).pick(RUN, 'managed_services', 'andrei');
    expect(picked.at).toBe('2026-11-14T09:08:16Z');

    for (let i = 0; i < 4; i++) await orchestrator.eventsAfter(RUN, 14 + i);
    const approved = await new PlanApprover(orchestrator).approve(RUN, 'andrei');
    expect(approved.at).toBe('2026-11-14T09:19:51Z');
  });

  it('updates the plan message in place with who approved it and why', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    const planTs = flow.slack.messages.find(message => message.message.text === 'The plan is waiting for approval')!.timestamp;
    await flow.clickPlan();
    await flow.tracking;

    const update = flow.slack.updates.find(updated => updated.timestamp === planTs)!;
    const shown = JSON.stringify(update.message);
    expect(update.message.blocks.some(block => block.type === 'actions')).toBe(false);
    expect(shown).toContain('Plan approved');
    expect(shown).toContain('andrei (slack) approved the plan');
    expect(shown).toContain('rehearsal held; plan approved from Slack');
  });

  it('refuses a second plan click once the run is complete and tells the person', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    await flow.clickPlan();
    await flow.tracking;
    await flow.runAction(approvePlanAction(new PlanApprover(flow.orchestrator)), { run_id: RUN, seq: 19 }, { id: 'U2', name: 'robi' });

    expect(flow.orchestrator.document().events).toHaveLength(20);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0]).toMatchObject({ channel: 'C1', user: 'U2' });
    expect(flow.ephemeral[0].text).toContain('not waiting at a gate');
  });
});
