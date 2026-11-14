import type { RunEvent } from './run.js';
import { actorName, describeEvent, stepLabel } from './event-text.js';
import type { LayoutCandidate, LayoutTarget } from './layout-choice.js';
import { layoutActionId } from './layout-choice.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import type { PlanSummary } from './plan-summary.js';
import { APPROVE_PLAN_ACTION } from './plan-approval.js';
import { basename, clip, compactEur, eur, humanDate } from './format.js';
import { planSentence, rehearsalSentence } from './summary-sentences.js';
import type { DiagramRef } from './diagram.js';
import { diagramBlocks } from './diagram.js';

const MAX_BLOCKS = 50;

type SlotMode = 'full' | 'image' | 'none';

const SLOT_MODES: SlotMode[] = ['full', 'image', 'none'];

export interface BlockKitMessage {
  blocks: any[];
  text: string;
}

export interface PlanActionValue {
  run_id: string;
  seq: number;
}

export interface LayoutActionValue {
  run_id: string;
  seq: number;
  layout: string;
}

export interface RunContext {
  project?: string;
  dashboardUrl?: string;
}

export function formatEvent(event: RunEvent): BlockKitMessage | null {
  if (event.status === 'started') return null;
  const headline = describeEvent(event);
  const blocks: any[] = [section(`*${stepLabel(event.step)}* — ${headline}`)];
  if (event.decision?.reason) blocks.push(section(event.decision.reason));
  blocks.push(context(eventContext(event)));
  return { text: headline, blocks };
}

export function formatLayoutGate(
  runId: string,
  event: RunEvent,
  candidates: LayoutCandidate[] = [],
  target?: LayoutTarget,
  runContext?: RunContext,
  diagrams?: Map<string, DiagramRef>
): BlockKitMessage {
  const offered = candidates.filter(candidate => candidate.feasible);
  const excluded = candidates.filter(candidate => !candidate.feasible);
  if (offered.length === 0) {
    const blocks: any[] = [
      header('A layout is waiting to be picked'),
      section('Pick the analyses to keep and the layout to rehearse on the dashboard. The run continues once a layout is picked.'),
    ];
    if (runContext?.dashboardUrl) blocks.push(actions([dashboardButton(runContext.dashboardUrl)]));
    blocks.push(context(eventContext(event)));
    return { text: describeEvent(event), blocks };
  }
  const lead = layoutLead(runContext, offered.length, target, event);
  const rich = offered.some(candidate =>
    candidate.monthlyEur !== undefined || candidate.horizonEur !== undefined || candidate.availabilityPct !== undefined ||
    candidate.risk !== undefined || candidate.effortHours !== undefined || candidate.paybackMonths !== undefined ||
    candidate.actions !== undefined
  );
  let blocks: any[] = [];
  for (const mode of SLOT_MODES) {
    blocks = layoutBlocks(runId, event, offered, excluded, target, runContext, lead, rich, slotFor(diagrams, runContext, mode));
    if (blocks.length <= MAX_BLOCKS) break;
  }
  return { text: 'Which architecture should we run?', blocks };
}

function slotFor(diagrams: Map<string, DiagramRef> | undefined, runContext: RunContext | undefined, mode: SlotMode) {
  return (candidate: LayoutCandidate): any[] => {
    if (mode === 'none') return [];
    const blocks = diagramBlocks(diagrams?.get(candidate.id), runContext?.dashboardUrl, clip(candidate.id, 200));
    return mode === 'image' ? blocks.slice(0, 1) : blocks;
  };
}

function layoutBlocks(
  runId: string,
  event: RunEvent,
  offered: LayoutCandidate[],
  excluded: LayoutCandidate[],
  target: LayoutTarget | undefined,
  runContext: RunContext | undefined,
  lead: string,
  rich: boolean,
  slot: (candidate: LayoutCandidate) => any[]
): any[] {
  const recommended = offered.find(candidate => candidate.recommended);
  const blocks: any[] = [header('Which architecture should we run?'), section(lead)];
  if (rich && recommended) blocks.push(section(recommendation(recommended, target)));
  offered.forEach((candidate, index) => {
    if (index > 0) blocks.push(divider());
    blocks.push(section(optionLine(candidate, rich)));
    blocks.push(...slot(candidate));
    const elements: any[] = [layoutButton(runId, event, candidate)];
    if (index === 0 && runContext?.dashboardUrl) elements.push(dashboardButton(runContext.dashboardUrl));
    blocks.push(actions(elements));
  });
  if (excluded.length > 0) {
    const groups = new Map<string, string[]>();
    for (const candidate of excluded) {
      const reason = shortReason(candidate);
      groups.set(reason, [...(groups.get(reason) ?? []), candidate.id]);
    }
    const lines = [...groups].map(([reason, ids]) => `${ids.join(', ')}: ${clip(reason, 100)}`);
    blocks.push(divider(), section(`*These can't run*: ${lines.join('; ')}`));
  }
  blocks.push(context(eventContext(event)));
  return blocks;
}

export function formatPlanGate(
  runId: string,
  event: RunEvent,
  rehearsal?: RehearsalSummary,
  plan?: PlanSummary,
  runContext?: RunContext,
  diagram?: DiagramRef
): BlockKitMessage {
  const missed = rehearsal?.passed === false;
  const blocks: any[] = [header(missed ? 'The rehearsal missed the forecast' : 'The rehearsal held — approve the plan?')];
  if (runContext?.project) blocks.push(context(`${runContext.project}, revision ${event.revision}`));
  if (rehearsal) {
    blocks.push(section(rehearsalSentence(rehearsal)));
    if (rehearsal.failure) blocks.push(section(rehearsal.failure));
  }
  if (plan) {
    blocks.push(divider(), section(`*The plan${plan.layout ? ` — ${plan.layout}` : ''}*`), section(planSentence(plan)));
    const lines = (plan.actions ?? []).slice(0, 3).map(action => `• ${action.component}: ${action.action}${action.to ? ` to ${action.to}` : ''}`);
    if (lines.length > 0) blocks.push(section(lines.join('\n')));
  }
  if (!rehearsal && !plan) blocks.push(section('Approving the plan completes the run.'));
  blocks.push(...diagramBlocks(diagram, runContext?.dashboardUrl, 'plan'));
  const elements: any[] = [{
    type: 'button',
    text: { type: 'plain_text', text: 'Approve plan' },
    style: 'primary',
    action_id: APPROVE_PLAN_ACTION,
    value: JSON.stringify(value(runId, event)),
  }];
  if (runContext?.dashboardUrl) elements.push(dashboardButton(runContext.dashboardUrl));
  blocks.push(actions(elements), context(eventContext(event)));
  return { text: missed ? 'The rehearsal missed the forecast' : 'The rehearsal held — approve the plan', blocks };
}

export function formatLayoutProgress(pick: RunEvent, frame: number, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  const step = Math.max(1, Math.min(frame + 1, 8));
  return {
    text: 'Rehearsal running',
    blocks: [
      header('Architecture picked'),
      section(`*${describeEvent(pick)}*`),
      ...diagramBlocks(diagram, runContext?.dashboardUrl, 'layout'),
      section(`The rehearsal is running on Floci, step ${step} of 8. The result and the plan follow here.`),
    ],
  };
}

export function formatLayoutDone(pick: RunEvent, rehearsal?: RehearsalSummary, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  const blocks: any[] = [
    header('Rehearsal complete'),
    section(`*${describeEvent(pick)}*`),
  ];
  if (rehearsal) blocks.push(section(rehearsalSentence(rehearsal)));
  blocks.push(...diagramBlocks(diagram, runContext?.dashboardUrl, 'layout'), context('The plan follows in the channel.'));
  return { text: 'Rehearsal complete', blocks };
}

export function formatLayoutStopped(pick: RunEvent, reason?: string, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  return {
    text: 'Rehearsal stopped',
    blocks: [
      header('Rehearsal stopped'),
      section(`*${describeEvent(pick)}*`),
      section(reason ?? 'The rehearsal stopped before a measurement.'),
      ...diagramBlocks(diagram, runContext?.dashboardUrl, 'layout'),
      context('The run stopped; see the failure message above.'),
    ],
  };
}

export function formatGateClosed(closing: RunEvent, rehearsal?: RehearsalSummary, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  const kind = closing.decision?.kind;
  const title = kind === 'approve_plan' ? 'The plan is approved' : kind === 'pick_layout' ? 'The architecture is picked' : 'The gate is closed';
  const headline = describeEvent(closing);
  const blocks: any[] = [header(title), section(`*${headline}*`)];
  if (closing.decision?.reason) blocks.push(section(closing.decision.reason));
  if (kind === 'pick_layout') blocks.push(section('Next: the rehearsal runs on Floci. Its result and the plan follow here.'));
  if (kind === 'approve_plan') blocks.push(section('The run is complete.'));
  if (kind === 'pick_layout' || kind === 'approve_plan') blocks.push(...diagramBlocks(diagram, runContext?.dashboardUrl, kind));
  if (rehearsal) blocks.push(divider(), section(rehearsalSentence(rehearsal)));
  blocks.push(context(eventContext(closing)));
  return { text: headline, blocks };
}

export function formatFailedRun(event: RunEvent): BlockKitMessage {
  const reason = event.decision?.reason ?? 'the run stopped';
  return {
    text: `Run stopped: ${reason}`,
    blocks: [
      header('The run stopped'),
      section(`*${stepLabel(event.step)}* — ${reason}`),
      context(eventContext(event)),
    ],
  };
}

function layoutLead(runContext: RunContext | undefined, offered: number, target: LayoutTarget | undefined, event: RunEvent): string {
  const sentences = [
    runContext?.project ? `The estate for ${runContext.project} is extracted.` : '',
    offered === 1 ? 'One option passes the hard constraints.' : `${offered} options pass the hard constraints.`,
    targetPhrase(target),
    event.revision > 0 ? `This is revision ${event.revision}.` : '',
  ].filter(Boolean);
  return sentences.join(' ');
}

function targetPhrase(target: LayoutTarget | undefined): string {
  const parts: string[] = [];
  if (target?.minAvailabilityPct !== undefined) parts.push(`at least ${target.minAvailabilityPct}% availability`);
  if (target?.maxMonthlyRunEur !== undefined) parts.push(`a budget of ${eur(target.maxMonthlyRunEur)} a month`);
  return parts.length ? `You asked for ${parts.join(' and ')}.` : '';
}

function recommendation(candidate: LayoutCandidate, target: LayoutTarget | undefined): string {
  const sentences = [`We recommend *${candidate.id}*.`];
  if (candidate.monthlyEur !== undefined) sentences.push(`It runs the estate for ${eur(candidate.monthlyEur)} a month.`);
  if (candidate.availabilityPct !== undefined) {
    sentences.push(
      target?.minAvailabilityPct !== undefined
        ? `It lands at ${candidate.availabilityPct}% availability, above your ${target.minAvailabilityPct}% target.`
        : `It lands at ${candidate.availabilityPct}% availability.`
    );
  }
  if (candidate.horizonEur !== undefined) {
    const horizon = target?.horizonMonths !== undefined ? `Over ${target.horizonMonths} months it costs ${compactEur(candidate.horizonEur)}.` : `Over the horizon it costs ${compactEur(candidate.horizonEur)}.`;
    sentences.push(horizon);
  }
  if (candidate.effortHours !== undefined) sentences.push(`The work takes ${candidate.effortHours} hours.`);
  if (candidate.paybackMonths !== undefined) sentences.push(`It pays back in ${candidate.paybackMonths} months.`);
  return sentences.join(' ');
}

function optionLine(candidate: LayoutCandidate, rich: boolean): string {
  const name = candidate.recommended ? `*${candidate.id}* — our pick` : `*${candidate.id}*`;
  if (!rich) {
    return candidate.recommended ? name : `${name}; not picked: ${lostReason(candidate)}.`;
  }
  const facts: string[] = [];
  if (candidate.monthlyEur !== undefined) facts.push(`${eur(candidate.monthlyEur)} a month`);
  if (candidate.availabilityPct !== undefined) facts.push(`${candidate.availabilityPct}% availability`);
  if (candidate.recommended) return `${name}: ${facts.join(', ')}.`;
  return `${name} — ${facts.join(', ')}; not picked: ${lostReason(candidate)}.`;
}

function layoutButton(runId: string, event: RunEvent, candidate: LayoutCandidate) {
  const value: LayoutActionValue = { run_id: runId, seq: event.seq, layout: candidate.id };
  const element: any = {
    type: 'button',
    text: { type: 'plain_text', text: `Rehearse ${candidate.id}` },
    action_id: layoutActionId(candidate.id),
    value: JSON.stringify(value),
  };
  if (candidate.recommended) element.style = 'primary';
  return element;
}

function value(runId: string, event: RunEvent): PlanActionValue {
  return { run_id: runId, seq: event.seq };
}

function eventContext(event: RunEvent): string {
  const parts = [`Event #${event.seq}`, humanDate(event.at)];
  if (event.revision > 0) parts.push(`revision ${event.revision}`);
  if (event.actor.kind === 'human') parts.push(`by ${actorName(event.actor)}`);
  if (event.output) parts.push(`wrote ${basename(event.output.file.path)}`);
  return parts.join(' · ');
}

function lostReason(candidate: LayoutCandidate): string {
  switch (candidate.lostBecause?.reason) {
    case 'cost': return 'it costs more over the horizon than the recommended option';
    case 'risk': return 'it carries more risk';
    case 'effort': return 'it takes more migration effort';
    case 'payback': return 'it pays back more slowly';
    default: return candidate.lostBecause?.detail ? clip(candidate.lostBecause.detail.split(':')[0], 120) : 'it did not rank first';
  }
}

function shortReason(candidate: LayoutCandidate): string {
  const detail = candidate.lostBecause?.detail;
  if (detail) return detail.split(':')[0];
  return candidate.lostBecause?.reason ?? 'a hard constraint';
}

function dashboardButton(url: string) {
  return { type: 'button', text: { type: 'plain_text', text: 'Details' }, action_id: 'view_dashboard', url };
}

function actions(elements: any[]) {
  return { type: 'actions', elements };
}

function divider() {
  return { type: 'divider' };
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function header(text: string) {
  return { type: 'header', text: { type: 'plain_text', text } };
}

function context(text: string) {
  return { type: 'context', elements: [{ type: 'mrkdwn', text }] };
}
