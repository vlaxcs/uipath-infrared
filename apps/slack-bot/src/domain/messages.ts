import type { Run, RunEvent, RunSummary } from './run.js';
import { actorName, describeEvent, stepLabel } from './event-text.js';
import type { LayoutCandidate } from './layout-choice.js';
import { layoutActionId } from './layout-choice.js';
import { APPROVE_PLAN_ACTION } from './plan-approval.js';

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

const STATUS_ICON: Record<string, string> = {
  started: '▶️',
  completed: '✅',
  failed: '❌',
  awaiting_approval: '⏸️',
  approved: '👤',
};

const RUN_ICON: Record<RunSummary['status'], string> = {
  running: '▶️',
  awaiting_approval: '⏸️',
  completed: '✅',
  failed: '❌',
};

export function formatRunHeader(run: Pick<Run, 'id' | 'project' | 'max_revisions'>, summary: RunSummary): BlockKitMessage {
  const waiting = summary.awaiting ? ` (${summary.awaiting} gate)` : '';
  return {
    text: `Run ${run.id}: ${summary.status}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${RUN_ICON[summary.status]} Run ${run.id}` } },
      {
        type: 'section',
        fields: [
          mrkdwn(`*Project:*\n${run.project}`),
          mrkdwn(`*Status:*\n${summary.status.replace('_', ' ')}${waiting}`),
          mrkdwn(`*Step:*\n${stepLabel(summary.step)}`),
          mrkdwn(`*Revisions:*\n${summary.revision} of ${run.max_revisions}`),
        ],
      },
    ],
  };
}

export function formatEvent(event: RunEvent): BlockKitMessage | null {
  if (event.status === 'started') return null;
  const headline = describeEvent(event);
  return {
    text: headline,
    blocks: [section(`${STATUS_ICON[event.status]} *${stepLabel(event.step)}*: ${headline}`), ...details(event)],
  };
}

export function formatLayoutGate(runId: string, event: RunEvent, candidates: LayoutCandidate[] = []): BlockKitMessage {
  const offered = candidates.filter(candidate => candidate.feasible);
  const excluded = candidates.filter(candidate => !candidate.feasible).map(candidate => candidate.id);
  if (offered.length === 0) {
    return {
      text: describeEvent(event),
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '⏸️ Layout waiting to be picked' } },
        section('Pick the analyses to keep and the layout to rehearse on the dashboard. The run continues once a layout is picked.'),
        context(eventContext(event)),
      ],
    };
  }
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: '⏸️ Which architecture should we migrate to?' } },
    section('Pick the layout to rehearse on Floci. The rehearsal comes back here, then the plan needs your approval.'),
    ...offered.map(candidate => section(candidateLine(candidate))),
    ...chunks(offered, 5).map(group => layoutButtons(runId, event, group)),
  ];
  if (excluded.length > 0) blocks.push(context(`Not offered (infeasible): ${excluded.join(', ')}`));
  blocks.push(context(eventContext(event)));
  return { text: describeEvent(event), blocks };
}

function layoutButtons(runId: string, event: RunEvent, candidates: LayoutCandidate[]) {
  return {
    type: 'actions',
    block_id: `layout_${runId}_${candidates[0].id}`,
    elements: candidates.map(candidate => {
      const value: LayoutActionValue = { run_id: runId, seq: event.seq, layout: candidate.id };
      return {
        type: 'button',
        text: { type: 'plain_text', text: candidate.id },
        style: 'primary',
        action_id: layoutActionId(candidate.id),
        value: JSON.stringify(value),
      };
    }),
  };
}

function candidateLine(candidate: LayoutCandidate): string {
  const parts = [`*${candidate.id}*`];
  if (candidate.rank !== undefined) parts.push(`rank ${candidate.rank}`);
  if (candidate.monthlyEur !== undefined) parts.push(`€${candidate.monthlyEur.toLocaleString('en-US')}/mo`);
  if (candidate.availabilityPct !== undefined) parts.push(`${candidate.availabilityPct}% availability`);
  if (candidate.risk !== undefined) parts.push(`risk ${candidate.risk}`);
  return parts.join(' · ');
}

function chunks<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
  return groups;
}

export function formatPlanGate(runId: string, event: RunEvent, rehearsal?: RunEvent): BlockKitMessage {
  const value: PlanActionValue = { run_id: runId, seq: event.seq };
  const blocks: any[] = [{ type: 'header', text: { type: 'plain_text', text: '⏸️ Plan waiting for approval' } }];
  if (rehearsal?.decision) blocks.push(rehearsalSection(rehearsal));
  blocks.push(
    section('Approving the plan completes the run.'),
    {
      type: 'actions',
      block_id: `plan_${runId}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve plan' },
          style: 'primary',
          action_id: APPROVE_PLAN_ACTION,
          value: JSON.stringify(value),
        },
      ],
    },
    context(eventContext(event))
  );
  return { text: describeEvent(event), blocks };
}

export function formatGateClosed(closing: RunEvent, rehearsal?: RunEvent): BlockKitMessage {
  const title = closing.decision?.kind === 'approve_plan' ? '✅ Plan approved' : '✅ Layout picked';
  const blocks: any[] = [{ type: 'header', text: { type: 'plain_text', text: title } }];
  if (rehearsal?.decision) blocks.push(rehearsalSection(rehearsal));
  const headline = describeEvent(closing);
  return { text: headline, blocks: [...blocks, section(`${STATUS_ICON.approved} *${headline}*`), ...details(closing)] };
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

function rehearsalSection(rehearsal: RunEvent) {
  return section(`*Rehearsal:* ${rehearsal.decision?.kind}: ${rehearsal.decision?.reason}`);
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function context(text: string) {
  return { type: 'context', elements: [{ type: 'mrkdwn', text }] };
}

function mrkdwn(text: string) {
  return { type: 'mrkdwn', text };
}
