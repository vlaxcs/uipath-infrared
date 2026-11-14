import { describe, it, expect } from 'vitest';
import { FakeSlackClient } from '../src/adapters/slack.js';
import { SampleOrchestrator } from '../src/adapters/sample-orchestrator.js';
import { RunTracker } from '../src/application/run-tracker.js';
import { LayoutPicker } from '../src/application/layout-picker.js';
import { PlanApprover } from '../src/application/plan-approver.js';
import type { Diagram, DiagramRenderer, DiagramRequest } from '../src/application/ports.js';
import { formatGateClosed, formatLayoutGate, formatPlanGate } from '../src/domain/messages.js';
import { candidatesOf, targetOf } from '../src/domain/layout-choice.js';
import { withoutDiagrams } from '../src/domain/diagram.js';
import type { DiagramRef } from '../src/domain/diagram.js';
import type { Run, RunEvent } from '../src/domain/run.js';
import { afterLayoutEvents, sampleEvent, sampleRun } from './sample.js';

const RUN = 'run-demo-shop-0001';
const LAYOUT_CARD = 'Which architecture should we run?';
const PLAN_CARD = 'Rehearsal held — approve the plan';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

async function until(condition: () => boolean) {
  for (let i = 0; i < 1000 && !condition(); i++) await tick();
  if (!condition()) throw new Error('condition never held');
}

class FakeRenderer implements DiagramRenderer {
  public requests: DiagramRequest[] = [];
  constructor(private available = true) {}
  async render(request: DiagramRequest): Promise<Diagram | null> {
    this.requests.push(request);
    if (!this.available) return null;
    return {
      pngPath: `/diagrams/${request.layout}-${request.state}.png`,
      title: `${request.layout} (${request.state})`,
      caption: `${request.layout}: 12 services, 3 zones`,
      alt: `Graph of the ${request.layout} layout`,
    };
  }
}

const images = (blocks: any[]) => blocks.filter(block => block.type === 'image');
const fileIds = (blocks: any[]) => images(blocks).map(block => block.slack_file.id);
const placeholders = (blocks: any[]) => blocks.filter(block => block.type === 'context' && block.elements[0].text.startsWith('Diagram unavailable'));

function startRun(renderer: DiagramRenderer, dashboardUrl?: string) {
  const orchestrator = new SampleOrchestrator(sampleRun(), afterLayoutEvents(), tick, 0, () => new Date('2026-11-14T09:25:00Z'));
  const slack = new FakeSlackClient();
  const tracking = new RunTracker(slack, orchestrator, 'infrared-runs', tick, 0, dashboardUrl, renderer).track(RUN);
  const card = (text: string) => slack.messages.find(message => message.message.text === text);
  const pick = (layout: string) => new LayoutPicker(orchestrator).pick(RUN, layout, 'andrei');
  const updatesOf = (text: string) => slack.updates.filter(update => update.timestamp === card(text)!.timestamp).map(update => update.message);
  return { orchestrator, slack, tracking, card, pick, updatesOf };
}

const INPUTS = { runId: RUN, result: 'result.1.json', infra: 'infra.json' };

const ref = (layout: string): DiagramRef => ({ fileId: `F-${layout}`, title: `${layout} target`, caption: `${layout} caption`, alt: `${layout} alt` });

describe('Diagram slots in the messages', () => {
  it('puts each candidate image under its fields and above its button', () => {
    const gate = sampleEvent(14);
    const candidates = candidatesOf(gate);
    const diagrams = new Map(candidates.map(candidate => [candidate.id, ref(candidate.id)]));
    const { blocks } = formatLayoutGate(RUN, gate, candidates, targetOf(gate), {}, diagrams);

    expect(fileIds(blocks)).toEqual(['F-consolidate', 'F-managed_services', 'F-move_to_onprem']);
    const firstImage = blocks.findIndex(block => block.type === 'image');
    expect(blocks[firstImage - 1].fields).toBeDefined();
    expect(blocks[firstImage + 1]).toMatchObject({ type: 'context', elements: [{ text: 'consolidate caption' }] });
    expect(blocks[firstImage + 2].elements[0].action_id).toBe('pick_layout_consolidate');
    expect(blocks[firstImage]).toEqual({
      type: 'image',
      slack_file: { id: 'F-consolidate' },
      alt_text: 'consolidate alt',
      title: { type: 'plain_text', text: 'consolidate target' },
    });
  });

  it('keeps the slot as a placeholder line when a diagram is missing', () => {
    const gate = sampleEvent(14);
    const candidates = candidatesOf(gate);
    const withDetails = formatLayoutGate(RUN, gate, candidates, targetOf(gate), { dashboardUrl: 'https://infrared.local' }, new Map([['consolidate', ref('consolidate')]]));
    expect(fileIds(withDetails.blocks)).toEqual(['F-consolidate']);
    expect(placeholders(withDetails.blocks).map(block => block.elements[0].text)).toEqual([
      'Diagram unavailable — open Details for the graph',
      'Diagram unavailable — open Details for the graph',
    ]);
    const plain = formatPlanGate(RUN, afterLayoutEvents().at(-1)!, undefined, undefined, {});
    expect(placeholders(plain.blocks).map(block => block.elements[0].text)).toEqual(['Diagram unavailable']);
  });

  it('stays within the 50-block limit by dropping captions, then the slots', () => {
    const gate = sampleEvent(14);
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `layout_${i}`, feasible: true, rank: i + 1, monthly_eur: 1000 + i }));
    const event = { ...gate, x_candidates: many } as RunEvent;
    const candidates = candidatesOf(event);
    const diagrams = new Map(candidates.map(candidate => [candidate.id, ref(candidate.id)]));
    const { blocks } = formatLayoutGate(RUN, event, candidates, undefined, {}, diagrams);
    expect(blocks.length).toBeLessThanOrEqual(50);
    expect(fileIds(blocks)).toHaveLength(8);
    expect(JSON.stringify(blocks)).not.toContain('caption');
  });

  it('clips long titles and alt text to the Slack limits', () => {
    const long = { fileId: 'F1', title: 't'.repeat(3000), caption: 'c', alt: 'a'.repeat(3000) };
    const pick = { ...sampleEvent(14), status: 'approved', decision: { kind: 'pick_layout', reason: 'r', layout: 'x' } } as RunEvent;
    const [image] = images(formatGateClosed(pick, undefined, long).blocks);
    expect(image.title.text.length).toBe(2000);
    expect(image.alt_text.length).toBe(2000);
  });

  it('swaps image blocks and their captions for the placeholder', () => {
    const gate = sampleEvent(14);
    const candidates = candidatesOf(gate);
    const message = formatLayoutGate(RUN, gate, candidates, targetOf(gate), {}, new Map(candidates.map(candidate => [candidate.id, ref(candidate.id)])));
    const swapped = withoutDiagrams(message);
    expect(images(swapped.blocks)).toHaveLength(0);
    expect(placeholders(swapped.blocks)).toHaveLength(3);
    expect(JSON.stringify(swapped)).not.toContain('caption');
  });
});

describe('Diagrams through a run', () => {
  it('renders the target of every offered candidate before posting the layout card', async () => {
    const renderer = new FakeRenderer();
    const flow = startRun(renderer);
    await until(() => Boolean(flow.card(LAYOUT_CARD)));

    expect(renderer.requests).toEqual([
      { layout: 'consolidate', state: 'target', inputs: INPUTS },
      { layout: 'managed_services', state: 'target', inputs: INPUTS },
      { layout: 'move_to_onprem', state: 'target', inputs: INPUTS },
    ]);
    expect(flow.slack.uploads.map(upload => upload.path)).toEqual([
      '/diagrams/consolidate-target.png', '/diagrams/managed_services-target.png', '/diagrams/move_to_onprem-target.png',
    ]);
    expect(fileIds(flow.card(LAYOUT_CARD)!.message.blocks)).toEqual(['F0001', 'F0002', 'F0003']);
  });

  it('reuses the picked layout file id through the pick, the progress and the result, and on the plan card and its approval', async () => {
    const renderer = new FakeRenderer();
    const flow = startRun(renderer);
    await until(() => Boolean(flow.card(LAYOUT_CARD)));
    await flow.pick('managed_services');
    await until(() => Boolean(flow.card(PLAN_CARD)));

    const layoutUpdates = flow.updatesOf(LAYOUT_CARD);
    expect(layoutUpdates.map(message => message.text)).toContain('Rehearsal complete');
    expect(layoutUpdates.every(message => JSON.stringify(fileIds(message.blocks)) === '["F0002"]')).toBe(true);
    expect(fileIds(flow.card(PLAN_CARD)!.message.blocks)).toEqual(['F0002']);

    await new PlanApprover(flow.orchestrator).approve(RUN, 'andrei');
    await flow.tracking;
    const approved = flow.updatesOf(PLAN_CARD).at(-1)!;
    expect(JSON.stringify(approved)).toContain('Plan approved');
    expect(fileIds(approved.blocks)).toEqual(['F0002']);
    expect(flow.slack.uploads).toHaveLength(3);
    expect(renderer.requests).toHaveLength(3);
  });

  it('shows the placeholder on every card when the renderer returns nothing', async () => {
    const flow = startRun(new FakeRenderer(false), 'https://infrared.local');
    await until(() => Boolean(flow.card(LAYOUT_CARD)));
    await flow.pick('consolidate');
    await until(() => Boolean(flow.card(PLAN_CARD)));

    expect(flow.slack.uploads).toHaveLength(0);
    expect(placeholders(flow.card(LAYOUT_CARD)!.message.blocks)).toHaveLength(3);
    expect(flow.updatesOf(LAYOUT_CARD).every(message => placeholders(message.blocks).length === 1)).toBe(true);
    expect(placeholders(flow.card(PLAN_CARD)!.message.blocks)[0].elements[0].text).toBe('Diagram unavailable — open Details for the graph');
  });

  it('shows the plan layout on the plan card, not the picked one', async () => {
    const base = sampleRun();
    const pick: RunEvent = {
      seq: 15, at: '2026-11-14T09:10:00Z', step: 'present', status: 'approved', revision: 1,
      actor: { kind: 'human', id: 'andrei', surface: 'slack' },
      decision: { kind: 'pick_layout', reason: 'layout picked from Slack', layout: 'consolidate' },
    };
    const tail = afterLayoutEvents().map(event => ({ ...event, seq: event.seq - 1 }));
    const run: Run = { ...base, status: 'awaiting_approval', awaiting: 'plan', step: 'rehearse', events: [...base.events, pick, ...tail] };
    const renderer = new FakeRenderer();
    const slack = new FakeSlackClient();
    await new RunTracker(slack, new SampleOrchestrator(run, [], tick, 0, () => new Date()), 'c', tick, 0, undefined, renderer).replay(run);

    expect(renderer.requests).toEqual([{ layout: 'managed_services', state: 'target', inputs: INPUTS }]);
    expect(slack.messages[0].message.text).toBe(PLAN_CARD);
    expect(fileIds(slack.messages[0].message.blocks)).toEqual(['F0001']);
  });

  it('renders nothing, and keeps the placeholder, when the run has no result or infra file yet', async () => {
    const base = sampleRun();
    const events = base.events.map(event => event.output?.contract === 'infra' ? { ...event, output: undefined } : event);
    const run: Run = { ...base, events };
    const renderer = new FakeRenderer();
    const slack = new FakeSlackClient();
    await new RunTracker(slack, new SampleOrchestrator(run, [], tick, 0, () => new Date()), 'c', tick, 0, undefined, renderer).replay(run);

    expect(renderer.requests).toEqual([]);
    expect(fileIds(slack.messages[0].message.blocks)).toEqual([]);
    expect(placeholders(slack.messages[0].message.blocks)).toHaveLength(3);
  });

  it('renders from the latest result, so a revised run gets new diagrams', async () => {
    const base = sampleRun();
    const run: Run = { ...base, events: base.events.filter(event => event.output?.file.path !== 'result.1.json') };
    const renderer = new FakeRenderer();
    await new RunTracker(new FakeSlackClient(), new SampleOrchestrator(run, [], tick, 0, () => new Date()), 'c', tick, 0, undefined, renderer).replay(run);

    expect(renderer.requests.map(request => request.inputs)).toContainEqual({ runId: RUN, result: 'result.0.json', infra: 'infra.json' });
    expect(renderer.requests.every(request => request.inputs.result === 'result.0.json')).toBe(true);
  });
});
