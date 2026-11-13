import { describe, it, expect } from 'vitest';
import { FakeSlackClient } from '../src/adapters/slack.js';
import { SampleOrchestrator } from '../src/adapters/sample-orchestrator.js';
import { RunTracker } from '../src/application/run-tracker.js';
import { PlanApprover } from '../src/application/plan-approver.js';
import { LayoutPicker } from '../src/application/layout-picker.js';
import { approvePlanAction } from '../src/entry/plan-action.js';
import { submitPlanApproval } from '../src/entry/plan-view.js';
import { pickLayoutAction } from '../src/entry/layout-action.js';
import { SLACK_APPROVAL_REASON } from '../src/domain/plan-approval.js';
import { summarize } from '../src/domain/run-summary.js';
import type { RunSummary } from '../src/domain/run.js';
import { afterLayoutEvents, sampleRun } from './sample.js';

const RUN = 'run-demo-shop-0001';
const CLICKED_AT = new Date('2026-11-14T09:25:00.123Z');
const LAYOUT_CARD = 'Which architecture should we run?';
const PLAN_CARD = 'Rehearsal held — approve the plan';
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
  const opened: any[] = [];
  const client = {
    chat: { postEphemeral: async (args: any) => { ephemeral.push(args); } },
    views: { open: async (args: any) => { opened.push(args); } },
  };
  const card = (messageText: string) => slack.messages.find(message => !message.threadTs && message.message.text === messageText);
  const thread = (timestamp: string) => slack.messages.filter(message => message.threadTs === timestamp);
  const channelTexts = () => slack.messages.filter(message => !message.threadTs).map(message => message.message.text);
  const button = (timestamp: string, actionId: string) => {
    const posted = slack.messages.find(message => message.timestamp === timestamp)!;
    return posted.message.blocks
      .filter(block => block.type === 'actions')
      .flatMap(block => block.elements)
      .find(element => element.action_id === actionId)!;
  };
  const runAction = (handler: any, value: object, user = { id: 'U1', name: 'andrei' }) =>
    handler({ body: { actions: [{ value: JSON.stringify(value) }], trigger_id: 'T1', user, channel: { id: 'C1' } }, ack: async () => {}, client });
  const clickLayout = async (layout: string, user?: { id: string; name: string }) => {
    const gate = card(LAYOUT_CARD)!;
    return runAction(pickLayoutAction(new LayoutPicker(orchestrator)), JSON.parse(button(gate.timestamp, `pick_layout_${layout}`).value), user);
  };
  const clickPlan = async (user?: { id: string; name: string }) => {
    const gate = card(PLAN_CARD)!;
    return runAction(approvePlanAction(orchestrator), JSON.parse(button(gate.timestamp, 'approve_plan').value), user);
  };
  const submitPlan = async (note: string | undefined, user = { id: 'U1', name: 'andrei' }) => {
    const view = opened.at(-1)!.view;
    const state = note === undefined ? { values: {} } : { values: { note: { reason: { value: note } } } };
    return submitPlanApproval(new PlanApprover(orchestrator))({
      ack: async () => {},
      body: { user },
      view: { private_metadata: view.private_metadata, state },
      client,
    });
  };
  const layoutPosted = () => Boolean(card(LAYOUT_CARD));
  const planPosted = () => Boolean(card(PLAN_CARD));
  return { orchestrator, slack, tracking, ephemeral, opened, client, runAction, card, thread, channelTexts, clickLayout, clickPlan, submitPlan, layoutPosted, planPosted, summary: (): RunSummary | undefined => summary };
}

describe('Slack gates', () => {
  it('shows only the gate in the channel and puts the run steps in a thread', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    for (let i = 0; i < 50; i++) await tick();

    expect(flow.channelTexts()).toEqual([LAYOUT_CARD]);
    const gate = flow.card(LAYOUT_CARD)!;
    expect(flow.thread(gate.timestamp).map(reply => reply.message.text)).toEqual([
      'The estate was extracted',
      'The investigation finished',
      'Candidate plans proposed',
      'A candidate breaks a hard constraint; back to propose',
      'Revised candidate plans proposed',
      'The candidates hold; on to present',
    ]);
    expect(flow.summary()).toBeUndefined();
    expect(flow.orchestrator.document()).toMatchObject({ status: 'awaiting_approval', awaiting: 'layout', step: 'present' });
    expect(flow.orchestrator.document().events).toHaveLength(14);
  });

  it('offers the recommended architecture first and carries each layout', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    const gate = flow.card(LAYOUT_CARD)!;
    const buttons = gate.message.blocks.filter(block => block.type === 'actions').flatMap(block => block.elements);
    expect(buttons.map(element => JSON.parse(element.value).layout)).toEqual(['consolidate', 'managed_services', 'move_to_onprem']);
    expect(buttons[0].text.text).toBe('Rehearse consolidate');
    expect(JSON.stringify(gate.message)).toContain('Recommended — consolidate');
  });

  it('records the pick, updates the gate in place and brings back the rehearsal and plan', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    const layoutTs = flow.card(LAYOUT_CARD)!.timestamp;
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);

    const update = flow.slack.updates.find(updated => updated.timestamp === layoutTs)!;
    const shown = JSON.stringify(update.message);
    expect(shown).toContain('Architecture picked');
    expect(shown).toContain('andrei (slack) picked the layout managed_services');
    expect(shown).toContain('the rehearsal runs on Floci');

    const planTs = flow.card(PLAN_CARD)!.timestamp;
    const replies = flow.thread(planTs).map(reply => reply.message.text);
    expect(replies).toContain('Layout picked; on to rehearse');
    expect(replies).toContain('The rehearsal held');
    expect(replies.every(text => !text.includes('The estate was extracted'))).toBe(true);
    expect(JSON.stringify(flow.card(PLAN_CARD)!.message)).toContain('99.92%');

    expect(flow.channelTexts()).toEqual([LAYOUT_CARD, PLAN_CARD]);
    const run = flow.orchestrator.document();
    expect(run.events).toHaveLength(19);
    expect(run.events.at(-1)).toMatchObject({ seq: 19, gate: 'plan' });
    expect(run).toMatchObject({ status: 'awaiting_approval', awaiting: 'plan', step: 'rehearse' });
  });

  it('binds the scripted plan to the architecture that was picked', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('consolidate');
    await until(flow.planPosted);

    const plan = JSON.stringify(flow.card(PLAN_CARD)!.message);
    expect(plan).toContain('Plan — consolidate');
    expect(plan).toContain('€133,308/mo → €74,365/mo');
    expect(plan).toContain('794h effort');
    expect(plan).not.toContain('managed_services');
  });

  it('shows a rehearsal progress line in the layout thread and completes it in place', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    const layoutTs = flow.card(LAYOUT_CARD)!.timestamp;
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);

    const progress = flow.thread(layoutTs).find(message => message.message.text === 'Rehearsal running');
    expect(progress).toBeDefined();
    expect(JSON.stringify(progress!.message)).toMatch(/[▰▱]{8}/);
    const updates = flow.slack.updates.filter(updated => updated.timestamp === progress!.timestamp);
    expect(JSON.stringify(updates.at(-1)?.message)).toContain('99.92%');
  });

  it('opens the approval modal without approving anything', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    await flow.clickPlan();

    expect(flow.opened).toHaveLength(1);
    expect(flow.opened[0].view.callback_id).toBe('plan_approval');
    expect(JSON.parse(flow.opened[0].view.private_metadata)).toEqual({ run_id: RUN, seq: 19, channel_id: 'C1' });
    expect(flow.orchestrator.document().events).toHaveLength(19);
    expect(flow.summary()).toBeUndefined();
  });

  it('records the modal note as the reason and completes the run', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    const planTs = flow.card(PLAN_CARD)!.timestamp;
    await flow.clickPlan();
    await flow.submitPlan('looks good');
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
      decision: { kind: 'approve_plan', reason: 'looks good' },
    });
    expect(run.events.map(event => event.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(run).toMatchObject({ status: 'completed', finished_at: '2026-11-14T09:25:00Z' });
    expect(flow.summary()?.status).toBe('completed');

    const update = flow.slack.updates.find(updated => updated.timestamp === planTs)!;
    const shown = JSON.stringify(update.message);
    expect(shown).toContain('Plan approved');
    expect(shown).toContain('andrei (slack) approved the plan');
    expect(shown).toContain('looks good');
    expect(shown).toContain('The run is complete');
  });

  it('uses the default reason when the note is left empty', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    await flow.clickPlan();
    await flow.submitPlan(undefined);
    await flow.tracking;

    expect(flow.orchestrator.document().events.at(-1)?.decision?.reason).toBe(SLACK_APPROVAL_REASON);
  });

  it('refuses a plan approval at the layout gate', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.runAction(approvePlanAction(flow.orchestrator), { run_id: RUN, seq: 14 });

    expect(flow.orchestrator.document().events).toHaveLength(14);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0].text).toContain('Could not open the approval');
    expect(flow.ephemeral[0].text).toContain('the plan gate is no longer open');
  });

  it('refuses an architecture the result did not offer', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.runAction(pickLayoutAction(new LayoutPicker(flow.orchestrator)), { run_id: RUN, seq: 14, layout: 'do_nothing' });

    expect(flow.orchestrator.document().events).toHaveLength(14);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0].text).toContain('layout do_nothing is not offered');
  });

  it('refuses a second approval after the run is complete', async () => {
    const flow = startRun();
    await until(flow.layoutPosted);
    await flow.clickLayout('managed_services');
    await until(flow.planPosted);
    await flow.clickPlan();
    await flow.submitPlan('looks good');
    await flow.tracking;
    await flow.submitPlan('again');

    expect(flow.orchestrator.document().events).toHaveLength(20);
    expect(flow.ephemeral).toHaveLength(1);
    expect(flow.ephemeral[0]).toMatchObject({ channel: 'C1', user: 'U1' });
    expect(flow.ephemeral[0].text).toContain('not waiting at a gate');
  });

  it('never dates an event before the event it follows', async () => {
    const orchestrator = new SampleOrchestrator(sampleRun(), afterLayoutEvents(), tick, 0, () => new Date('2026-11-13T12:00:00Z'));
    for (let i = 0; i < 14; i++) await orchestrator.eventsAfter(RUN, i);

    const picked = await new LayoutPicker(orchestrator).pick(RUN, 'managed_services', 'andrei');
    expect(picked.at).toBe('2026-11-14T09:08:16Z');

    for (let i = 0; i < 4; i++) await orchestrator.eventsAfter(RUN, 14 + i);
    const approved = await new PlanApprover(orchestrator).approve(RUN, 'andrei', 'looks good');
    expect(approved.at).toBe('2026-11-14T09:19:51Z');
  });
});
