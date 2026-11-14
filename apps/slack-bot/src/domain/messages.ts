import type { RunEvent } from './run.js';
import { actorName, describeEvent, stepLabel } from './event-text.js';
import type { LayoutCandidate, LayoutTarget } from './layout-choice.js';
import { layoutActionId } from './layout-choice.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import type { PlanSummary } from './plan-summary.js';
import { APPROVE_PLAN_ACTION } from './plan-approval.js';
import { basename, clip, compactEur, countPhrase, eur, humanDate } from './format.js';
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
  const blocks: any[] = [header('Which architecture should we run?'), section(lead)];
  offered.forEach((candidate, index) => {
    if (index > 0) blocks.push(divider());
    blocks.push(section(candidate.recommended ? `*${candidate.id}* — recommended` : `*${candidate.id}*`));
    const fields = candidateFields(candidate, target, rich);
    if (fields.length > 0) blocks.push(fieldsBlock(fields));
    if (!candidate.recommended) blocks.push(section(lostLine(candidate)));
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
    blocks.push(divider(), section('*These can\'t run*'), section(lines.join('\n')));
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
    blocks.push(section('*The rehearsal*'));
    blocks.push(fieldsBlock(rehearsalFields(rehearsal)));
    if (rehearsal.failure) blocks.push(section(rehearsal.failure));
  }
  if (plan) {
    blocks.push(divider(), section(`*The plan${plan.layout ? ` — ${plan.layout}` : ''}*`));
    blocks.push(section(planSentence(plan)));
    const lines = (plan.actions ?? []).slice(0, 3).map(action => `• ${action.component}: ${action.action}${action.to ? ` to ${action.to}` : ''}`);
    if (lines.length > 0) blocks.push(section(`*First changes*\n${lines.join('\n')}`));
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
  return {
    text: 'Rehearsal complete',
    blocks: [
      header('Rehearsal complete'),
      section(`*${describeEvent(pick)}*`),
      fieldsBlock(rehearsalFields(rehearsal ?? {})),
      ...diagramBlocks(diagram, runContext?.dashboardUrl, 'layout'),
      context('The plan follows in the channel.'),
    ],
  };
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
  if (rehearsal) {
    blocks.push(divider(), section('*The rehearsal*'));
    const fields = rehearsalFields(rehearsal);
    if (fields.length > 0) blocks.push(fieldsBlock(fields));
  }
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

function candidateFields(candidate: LayoutCandidate, target: LayoutTarget | undefined, rich: boolean): string[] {
  if (!rich) return [];
  const horizon = candidate.horizonEur !== undefined
    ? `${compactEur(candidate.horizonEur)}${target?.horizonMonths !== undefined ? ` over ${target.horizonMonths} months` : ''}`
    : 'not estimated';
  const availability = candidate.availabilityPct !== undefined
    ? `${candidate.availabilityPct}%${target?.minAvailabilityPct !== undefined ? `, you asked for ${target.minAvailabilityPct}%` : ''}`
    : 'not estimated';
  const effort: string[] = [];
  if (candidate.effortHours !== undefined) effort.push(`${candidate.effortHours} hours of work`);
  if (candidate.paybackMonths !== undefined) effort.push(`pays back in ${candidate.paybackMonths} months`);
  return [
    field('Cost today', candidate.monthlyEur !== undefined ? `${eur(candidate.monthlyEur)} a month` : 'not estimated'),
    field('Over the horizon', horizon),
    field('Availability', availability),
    field('Risk score', candidate.risk !== undefined ? `${candidate.risk} out of 1` : 'not estimated'),
    field('Effort', effort.length > 0 ? effort.join(', ') : 'not estimated'),
    field('Changes', candidate.actions !== undefined ? countPhrase(candidate.actions, 'action', 'actions') : 'not estimated'),
  ];
}

function rehearsalFields(rehearsal: RehearsalSummary): string[] {
  const availability = rehearsal.measuredAvailabilityPct !== undefined
    ? `${rehearsal.measuredAvailabilityPct}%${rehearsal.targetAvailabilityPct !== undefined ? `, you asked for ${rehearsal.targetAvailabilityPct}%` : ''}`
    : 'not measured';
  const result = rehearsal.passed === undefined ? 'not measured' : rehearsal.passed ? 'Held' : 'Missed';
  const latency = rehearsal.latency === undefined
    ? 'not measured'
    : [rehearsal.latency.baselineP95, rehearsal.latency.failureP95, rehearsal.latency.recoveryP95]
        .map(value => value === undefined ? '—' : `${value}`)
        .join(' → ');
  return [
    field('Availability', availability),
    field('Result', result),
    field('Latency p95', rehearsal.latency === undefined ? latency : `${latency} ms`),
  ];
}

function planSentence(plan: PlanSummary): string {
  const parts: string[] = [];
  if (plan.monthlyEurNow !== undefined && plan.monthlyEurAfter !== undefined) {
    parts.push(`The estate moves from ${eur(plan.monthlyEurNow)} a month to ${eur(plan.monthlyEurAfter)} a month.`);
  } else if (plan.monthlyEurAfter !== undefined) {
    parts.push(`The estate runs at ${eur(plan.monthlyEurAfter)} a month.`);
  }
  const size: string[] = [];
  if (plan.steps !== undefined) size.push(countPhrase(plan.steps, 'step', 'steps'));
  if (plan.actions?.length) size.push(countPhrase(plan.actions.length, 'action', 'actions'));
  if (size.length > 0) parts.push(`The plan has ${size.join(' and ')}.`);
  const effort: string[] = [];
  if (plan.effortHours !== undefined) effort.push(`${plan.effortHours} hours of work`);
  if (plan.cutoverDowntimeHours !== undefined) effort.push(`up to ${plan.cutoverDowntimeHours} hours of downtime`);
  if (effort.length > 0) parts.push(`It takes ${effort.join(' with ')}.`);
  if (plan.availabilityPct !== undefined) parts.push(`The result runs at ${plan.availabilityPct}% availability.`);
  return parts.length > 0 ? parts.join(' ') : 'The plan follows the rehearsal.';
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

function lostLine(candidate: LayoutCandidate): string {
  return `Not picked: ${lostReason(candidate)}.`;
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

function field(label: string, value: string): string {
  return `*${label}*\n${value}`;
}

function fieldsBlock(fields: string[]) {
  return { type: 'section', fields: fields.map(text => ({ type: 'mrkdwn', text })) };
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
