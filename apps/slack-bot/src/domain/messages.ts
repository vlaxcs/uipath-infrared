import type { RunEvent } from './run.js';
import { actorName, describeEvent, stepLabel } from './event-text.js';
import type { LayoutCandidate, LayoutTarget } from './layout-choice.js';
import { layoutActionId } from './layout-choice.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import type { PlanSummary } from './plan-summary.js';
import { APPROVE_PLAN_ACTION } from './plan-approval.js';
import { clip, compactEur, eur } from './format.js';
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
  return {
    text: headline,
    blocks: [section(`*${stepLabel(event.step)}*\n${headline}`), ...details(event)],
  };
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
      header('Layout waiting to be picked'),
      section('Pick the analyses to keep and the layout to rehearse on the dashboard. The run continues once a layout is picked.'),
    ];
    if (runContext?.dashboardUrl) blocks.push(actions([dashboardButton(runContext.dashboardUrl)]));
    blocks.push(context(eventContext(event)));
    return { text: describeEvent(event), blocks };
  }
  const lead = [
    runContext?.project ?? '',
    `${offered.length} options pass the hard constraints`,
    target?.minAvailabilityPct !== undefined ? `target ${target.minAvailabilityPct}% availability` : '',
    target?.maxMonthlyRunEur !== undefined ? `budget ${eur(target.maxMonthlyRunEur)}/mo` : '',
    `revision ${event.revision}`,
  ].filter(Boolean).join(' · ');
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
  const blocks: any[] = [header('Which architecture should we run?'), context(lead)];
  offered.forEach((candidate, index) => {
    if (index > 0) blocks.push(divider());
    blocks.push(section(candidate.recommended ? `*Recommended — ${candidate.id}*` : `*${candidate.id}*`));
    const fields = candidateFields(candidate, target, rich);
    if (fields.length > 0) blocks.push(fieldsBlock(fields));
    if (!candidate.recommended && rich) blocks.push(section(`Not picked: ${lostReason(candidate)}`));
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
    const lines = [...groups].map(([reason, ids]) => `${ids.join(', ')} — ${clip(reason, 100)}`);
    blocks.push(divider(), section('*Not viable*'), section(lines.join('\n')));
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
  const value: PlanActionValue = { run_id: runId, seq: event.seq };
  const blocks: any[] = [header(missed ? 'Rehearsal missed the forecast' : 'Rehearsal held — approve the plan?')];
  if (runContext?.project) blocks.push(context(`${runContext.project} · revision ${event.revision}`));
  if (rehearsal) {
    blocks.push(section('*Rehearsal*'));
    blocks.push(fieldsBlock(rehearsalFields(rehearsal)));
    blocks.push(section(`*Failure*\n${rehearsal.failure ?? '—'}`));
  }
  if (plan) {
    blocks.push(divider(), section(`*Plan${plan.layout ? ` — ${plan.layout}` : ''}*`));
    blocks.push(fieldsBlock(planFields(plan)));
    const lines = (plan.actions ?? []).slice(0, 3).map(action => `• ${action.component}: ${action.action}${action.to ? ` to ${action.to}` : ''}`);
    blocks.push(section(`*First changes*\n${lines.length > 0 ? lines.join('\n') : '—'}`));
  }
  if (!rehearsal && !plan) blocks.push(section('Approving the plan completes the run.'));
  blocks.push(...diagramBlocks(diagram, runContext?.dashboardUrl, 'plan'));
  const elements: any[] = [{
    type: 'button',
    text: { type: 'plain_text', text: 'Approve plan' },
    style: 'primary',
    action_id: APPROVE_PLAN_ACTION,
    value: JSON.stringify(value),
  }];
  if (runContext?.dashboardUrl) elements.push(dashboardButton(runContext.dashboardUrl));
  blocks.push(actions(elements), context(eventContext(event)));
  return { text: missed ? 'The rehearsal missed the forecast' : 'Rehearsal held — approve the plan', blocks };
}

export function formatLayoutProgress(pick: RunEvent, frame: number, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  const step = Math.max(1, Math.min(frame + 1, 8));
  const bar = '▰'.repeat(step) + '▱'.repeat(8 - step);
  return {
    text: 'Rehearsal running',
    blocks: [
      header('Architecture picked'),
      section(`*${describeEvent(pick)}*`),
      ...diagramBlocks(diagram, runContext?.dashboardUrl, 'layout'),
      section('Rehearsal running on Floci. The result and the plan follow here.'),
      context(bar),
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
      context('The run stopped; see the failure card.'),
    ],
  };
}

export function formatGateClosed(closing: RunEvent, rehearsal?: RehearsalSummary, diagram?: DiagramRef, runContext?: RunContext): BlockKitMessage {
  const kind = closing.decision?.kind;
  const title = kind === 'approve_plan' ? 'Plan approved' : kind === 'pick_layout' ? 'Architecture picked' : 'Gate closed';
  const headline = describeEvent(closing);
  const blocks: any[] = [header(title), section(`*${headline}*`)];
  if (kind === 'pick_layout') blocks.push(section('Next: the rehearsal runs on Floci. Its result and the plan follow here.'));
  if (kind === 'approve_plan') blocks.push(section('The run is complete.'));
  if (kind === 'pick_layout' || kind === 'approve_plan') blocks.push(...diagramBlocks(diagram, runContext?.dashboardUrl, kind));
  if (rehearsal) {
    blocks.push(divider(), section('*Rehearsal*'));
    const fields = rehearsalFields(rehearsal);
    if (fields.length > 0) blocks.push(fieldsBlock(fields));
  }
  blocks.push(...details(closing));
  return { text: headline, blocks };
}

export function formatFailedRun(event: RunEvent): BlockKitMessage {
  const reason = event.decision?.reason ?? 'the run stopped';
  return {
    text: `Run stopped: ${reason}`,
    blocks: [header('Run stopped'), section(`*${stepLabel(event.step)}*\n${describeEvent(event)}\n\n${reason}`), context(eventContext(event))],
  };
}

function candidateFields(candidate: LayoutCandidate, target: LayoutTarget | undefined, rich: boolean): string[] {
  if (!rich) return [];
  const months = target?.horizonMonths !== undefined ? ` over ${target.horizonMonths} months` : '';
  const targetSuffix = target?.minAvailabilityPct !== undefined ? ` vs ${target.minAvailabilityPct}% target` : '';
  const effort = [
    candidate.effortHours !== undefined ? `${candidate.effortHours}h` : '',
    candidate.paybackMonths !== undefined ? `${candidate.paybackMonths} months payback` : '',
  ].filter(Boolean).join(' · ');
  return [
    field('Cost now', candidate.monthlyEur !== undefined ? `${eur(candidate.monthlyEur)}/mo` : '—'),
    field('Horizon', candidate.horizonEur !== undefined ? `${compactEur(candidate.horizonEur)}${months}` : '—'),
    field('Availability', candidate.availabilityPct !== undefined ? `${candidate.availabilityPct}%${targetSuffix}` : '—'),
    field('Risk', candidate.risk !== undefined ? `${candidate.risk}` : '—'),
    field('Effort', effort || '—'),
    field('Actions', candidate.actions !== undefined ? `${candidate.actions}` : '—'),
  ];
}

function rehearsalFields(rehearsal: RehearsalSummary): string[] {
  const target = rehearsal.targetAvailabilityPct !== undefined ? ` vs ${rehearsal.targetAvailabilityPct}% target` : '';
  const latency = rehearsal.latency;
  const points = latency === undefined
    ? '—'
    : [latency.baselineP95, latency.failureP95, latency.recoveryP95].map(value => value === undefined ? '—' : `${value}`).join(' → ');
  return [
    field('Availability', rehearsal.measuredAvailabilityPct !== undefined ? `${rehearsal.measuredAvailabilityPct}%${target}` : '—'),
    field('Result', rehearsal.passed === undefined ? '—' : rehearsal.passed ? 'Held' : 'Missed'),
    field('Latency p95', `${points} ms`),
  ];
}

function planFields(plan: PlanSummary): string[] {
  const size = [
    plan.steps !== undefined ? `${plan.steps} steps` : '',
    plan.actions?.length ? `${plan.actions.length} actions` : '',
  ].filter(Boolean).join(' · ');
  const cost = plan.monthlyEurNow !== undefined && plan.monthlyEurAfter !== undefined
    ? `${eur(plan.monthlyEurNow)}/mo → ${eur(plan.monthlyEurAfter)}/mo`
    : '—';
  const effort = [
    plan.effortHours !== undefined ? `${plan.effortHours}h effort` : '',
    plan.cutoverDowntimeHours !== undefined ? `${plan.cutoverDowntimeHours}h downtime` : '',
  ].filter(Boolean).join(' · ');
  return [
    field('Plan size', size || '—'),
    field('Cost', cost),
    field('Effort', effort || '—'),
    field('Availability', plan.availabilityPct !== undefined ? `${plan.availabilityPct}%` : '—'),
  ];
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

function details(event: RunEvent): any[] {
  const blocks: any[] = [];
  if (event.decision) blocks.push(section(`*Decision:* ${event.decision.kind}\n*Reason:* ${event.decision.reason}`));
  blocks.push(context(eventContext(event)));
  return blocks;
}

function eventContext(event: RunEvent): string {
  const parts = [`#${event.seq}`, event.at];
  if (event.revision > 0) parts.push(`revision ${event.revision}`);
  if (event.actor.kind === 'human') parts.push(`by ${actorName(event.actor)}`);
  if (event.output) parts.push(`${event.output.contract}: ${event.output.file.path}`);
  return parts.join(' · ');
}

function lostReason(candidate: LayoutCandidate): string {
  switch (candidate.lostBecause?.reason) {
    case 'cost': return 'higher expected total cost';
    case 'risk': return 'higher risk';
    case 'effort': return 'more migration effort';
    case 'payback': return 'slower payback';
    default: return candidate.lostBecause?.detail ? clip(candidate.lostBecause.detail.split(':')[0], 120) : '—';
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
