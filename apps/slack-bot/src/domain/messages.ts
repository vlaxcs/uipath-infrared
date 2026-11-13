import type { RunEvent } from './run.js';
import { actorName, describeEvent, stepLabel } from './event-text.js';
import type { LayoutCandidate, LayoutTarget } from './layout-choice.js';
import { layoutActionId } from './layout-choice.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import type { PlanSummary } from './plan-summary.js';
import { APPROVE_PLAN_ACTION } from './plan-approval.js';
import { clip, compactEur, eur } from './format.js';
import { planText, rehearsalText } from './approval-view.js';

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

const STATUS_ICON: Record<string, string> = {
  started: '▶️',
  completed: '✅',
  failed: '❌',
  awaiting_approval: '⏸️',
  approved: '👤',
};

export function formatEvent(event: RunEvent): BlockKitMessage | null {
  if (event.status === 'started') return null;
  const headline = describeEvent(event);
  return {
    text: headline,
    blocks: [section(`${STATUS_ICON[event.status]} *${stepLabel(event.step)}*: ${headline}`), ...details(event)],
  };
}

export function formatLayoutGate(
  runId: string,
  event: RunEvent,
  candidates: LayoutCandidate[] = [],
  target?: LayoutTarget,
  runContext?: RunContext
): BlockKitMessage {
  const offered = candidates.filter(candidate => candidate.feasible);
  const excluded = candidates.filter(candidate => !candidate.feasible);
  if (offered.length === 0) {
    const blocks: any[] = [
      header('⏸️ Layout waiting to be picked'),
      section('Pick the analyses to keep and the layout to rehearse on the dashboard. The run continues once a layout is picked.'),
    ];
    if (runContext?.dashboardUrl) blocks.push(actions([dashboardButton(runContext.dashboardUrl)]));
    blocks.push(context(eventContext(event)));
    return { text: describeEvent(event), blocks };
  }
  const lead = [
    `${offered.length} options pass the hard constraints`,
    target?.minAvailabilityPct !== undefined ? `target ${target.minAvailabilityPct}% availability` : '',
    target?.maxMonthlyRunEur !== undefined ? `budget ${eur(target.maxMonthlyRunEur)}/mo` : '',
    `revision ${event.revision}`,
  ].filter(Boolean).join(' · ');
  const blocks: any[] = [
    header('🏗️ Which architecture should we run?'),
    context(`${runContext?.project ? `${runContext.project} · ` : ''}${lead}`),
    ...offered.map(candidate => section(candidateCard(candidate, target))),
    ...chunks(offered, 5).map(group => layoutButtons(runId, event, group, runContext?.dashboardUrl)),
  ];
  if (excluded.length > 0) {
    const reasons = excluded.map(candidate => `${candidate.id} (${clip(candidate.lostBecause?.detail ?? candidate.lostBecause?.reason ?? 'infeasible', 70)})`);
    blocks.push(context(`Not viable: ${reasons.join(' · ')}`));
  }
  blocks.push(context(eventContext(event)));
  return { text: 'Which architecture should we run?', blocks };
}

export function formatPlanGate(
  runId: string,
  event: RunEvent,
  rehearsal?: RehearsalSummary,
  plan?: PlanSummary,
  runContext?: RunContext
): BlockKitMessage {
  const missed = rehearsal?.passed === false;
  const value: PlanActionValue = { run_id: runId, seq: event.seq };
  const blocks: any[] = [header(missed ? '🧪 Rehearsal missed the forecast' : '🧪 Rehearsal held — approve the plan?')];
  if (runContext?.project) blocks.push(context(`${runContext.project} · revision ${event.revision}`));
  if (rehearsal) blocks.push(section(rehearsalText(rehearsal)));
  if (plan) blocks.push(section(planText(plan)));
  if (!rehearsal && !plan) blocks.push(section('Approving the plan completes the run.'));
  const elements: any[] = [{
    type: 'button',
    text: { type: 'plain_text', text: 'Approve plan' },
    style: 'primary',
    action_id: APPROVE_PLAN_ACTION,
    value: JSON.stringify(value),
  }];
  if (runContext?.dashboardUrl) elements.push(dashboardButton(runContext.dashboardUrl));
  blocks.push(actions(elements));
  blocks.push(context(eventContext(event)));
  return { text: missed ? 'The rehearsal missed the forecast' : 'Rehearsal held — approve the plan', blocks };
}

export function formatGateClosed(closing: RunEvent, rehearsal?: RehearsalSummary): BlockKitMessage {
  const kind = closing.decision?.kind;
  const title = kind === 'approve_plan' ? '✅ Plan approved' : kind === 'pick_layout' ? '✅ Architecture picked' : '✅ Gate closed';
  const headline = describeEvent(closing);
  const blocks: any[] = [header(title), section(`${STATUS_ICON.approved} *${headline}*`)];
  if (kind === 'pick_layout') blocks.push(section('Next: the rehearsal runs on Floci. Its result and the plan follow here.'));
  if (kind === 'approve_plan') blocks.push(section('The run is complete.'));
  if (rehearsal) blocks.push(section(rehearsalText(rehearsal)));
  blocks.push(...details(closing));
  return { text: headline, blocks };
}

export function formatFailedRun(event: RunEvent): BlockKitMessage {
  const reason = event.decision?.reason ?? 'the run stopped';
  return {
    text: `Run failed: ${reason}`,
    blocks: [header('❌ Run failed'), section(`*${stepLabel(event.step)}*: ${describeEvent(event)}\n${reason}`), context(eventContext(event))],
  };
}

function layoutButtons(runId: string, event: RunEvent, candidates: LayoutCandidate[], dashboardUrl?: string) {
  const elements: any[] = candidates.map(candidate => {
    const value: LayoutActionValue = { run_id: runId, seq: event.seq, layout: candidate.id };
    const element: any = {
      type: 'button',
      text: { type: 'plain_text', text: candidate.recommended ? 'Rehearse this' : 'Rehearse' },
      action_id: layoutActionId(candidate.id),
      value: JSON.stringify(value),
    };
    if (candidate.recommended) element.style = 'primary';
    return element;
  });
  if (dashboardUrl) elements.push(dashboardButton(dashboardUrl));
  return { type: 'actions', block_id: `layout_${runId}_${candidates[0].id}`, elements };
}

function candidateCard(candidate: LayoutCandidate, target?: LayoutTarget): string {
  const title = candidate.recommended ? `⭐ *RECOMMENDED — ${candidate.id}*` : `*${candidate.id}*`;
  const horizon = candidate.horizonEur !== undefined
    ? `${compactEur(candidate.horizonEur)} over ${target?.horizonMonths !== undefined ? `${target.horizonMonths} months` : 'the horizon'}`
    : '';
  const cost = [candidate.monthlyEur !== undefined ? `${eur(candidate.monthlyEur)}/mo now` : '', horizon].filter(Boolean).join(' · ');
  const availability = candidate.availabilityPct !== undefined
    ? `${candidate.availabilityPct}% availability${target?.minAvailabilityPct !== undefined ? ` vs ${target.minAvailabilityPct}% target ${candidate.availabilityPct >= target.minAvailabilityPct ? '✅' : '⚠'}` : ''}`
    : '';
  const meta = [
    candidate.rank !== undefined && !candidate.recommended ? `rank ${candidate.rank}` : '',
    availability,
    candidate.risk !== undefined ? `risk ${candidate.risk}` : '',
  ].filter(Boolean).join(' · ');
  const effort = [
    candidate.effortHours !== undefined ? `${candidate.effortHours}h effort` : '',
    candidate.paybackMonths !== undefined ? `payback ${candidate.paybackMonths} months` : '',
    candidate.actions !== undefined ? `${candidate.actions} actions` : '',
  ].filter(Boolean).join(' · ');
  const why = !candidate.recommended && candidate.lostBecause
    ? `Not picked: ${clip(candidate.lostBecause.detail ?? candidate.lostBecause.reason, 120)}`
    : '';
  return [title, cost, meta, effort, why].filter(Boolean).join('\n');
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

function dashboardButton(url: string) {
  return { type: 'button', text: { type: 'plain_text', text: 'Details' }, action_id: 'view_dashboard', url };
}

function actions(elements: any[]) {
  return { type: 'actions', elements };
}

function chunks<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
  return groups;
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
