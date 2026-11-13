import type { RunEvent } from './run.js';
import type { PlanSummary } from './plan-summary.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import { eur } from './format.js';

export const PLAN_APPROVAL_VIEW = 'plan_approval';

export interface PlanApprovalMetadata {
  run_id: string;
  seq: number;
  channel_id?: string;
}

export function planApprovalView(
  runId: string,
  event: RunEvent,
  rehearsal?: RehearsalSummary,
  plan?: PlanSummary,
  channelId?: string
): any {
  const blocks: any[] = [];
  if (rehearsal) blocks.push(section(rehearsalText(rehearsal)));
  if (plan) blocks.push(section(planText(plan)));
  if (!rehearsal && !plan) blocks.push(section('Approving the plan completes the run.'));
  blocks.push({
    type: 'input',
    block_id: 'note',
    optional: true,
    label: { type: 'plain_text', text: 'Note (optional)' },
    element: {
      type: 'plain_text_input',
      action_id: 'reason',
      max_length: 300,
      placeholder: { type: 'plain_text', text: 'Why you approve' },
    },
  });
  const metadata: PlanApprovalMetadata = { run_id: runId, seq: event.seq };
  if (channelId) metadata.channel_id = channelId;
  return {
    type: 'modal',
    callback_id: PLAN_APPROVAL_VIEW,
    private_metadata: JSON.stringify(metadata),
    title: { type: 'plain_text', text: 'Approve the plan' },
    submit: { type: 'plain_text', text: 'Approve' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
}

export function rehearsalText(rehearsal: RehearsalSummary): string {
  const target = rehearsal.targetAvailabilityPct !== undefined ? ` vs ${rehearsal.targetAvailabilityPct}% target` : '';
  const lines = [
    '*Rehearsal*',
    `Availability: ${rehearsal.measuredAvailabilityPct !== undefined ? `${rehearsal.measuredAvailabilityPct}%${target}` : '—'}`,
    `Result: ${rehearsal.passed === undefined ? '—' : rehearsal.passed ? 'Held' : 'Missed'}`,
    `Failure: ${rehearsal.failure ?? '—'}`,
  ];
  const latency = rehearsal.latency;
  const points = latency === undefined
    ? '—'
    : [latency.baselineP95, latency.failureP95, latency.recoveryP95].map(value => value === undefined ? '—' : `${value}`).join(' → ');
  lines.push(`Latency p95: ${points} ms`);
  return lines.join('\n');
}

export function planText(plan: PlanSummary): string {
  const lines = [`*Plan${plan.layout ? ` — ${plan.layout}` : ''}*`];
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
  lines.push(`Plan size: ${size || '—'}`);
  lines.push(`Cost: ${cost}`);
  lines.push(`Effort: ${effort || '—'}`);
  lines.push(`Availability: ${plan.availabilityPct !== undefined ? `${plan.availabilityPct}%` : '—'}`);
  for (const action of (plan.actions ?? []).slice(0, 3)) {
    lines.push(`• ${action.component}: ${action.action}${action.to ? ` → ${action.to}` : ''}`);
  }
  return lines.join('\n');
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}
