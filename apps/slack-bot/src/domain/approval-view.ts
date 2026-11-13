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
  const lines = ['*Rehearsal*'];
  if (rehearsal.measuredAvailabilityPct !== undefined) {
    const verdict = rehearsal.passed === false ? '⚠' : rehearsal.passed === true ? '✅' : '';
    const target = rehearsal.targetAvailabilityPct !== undefined ? ` vs ${rehearsal.targetAvailabilityPct}% target` : '';
    const gap = rehearsal.gapPct !== undefined ? ` (${rehearsal.gapPct >= 0 ? '+' : ''}${rehearsal.gapPct})` : '';
    lines.push(`Availability *${rehearsal.measuredAvailabilityPct}%*${target} ${verdict}${gap}`);
  }
  if (rehearsal.failure) lines.push(`Failure ${rehearsal.failure}`);
  const latency = rehearsal.latency;
  if (latency && (latency.baselineP95 !== undefined || latency.failureP95 !== undefined || latency.recoveryP95 !== undefined)) {
    const points = [latency.baselineP95, latency.failureP95, latency.recoveryP95].map(value => value === undefined ? '—' : `${value}`).join(' → ');
    lines.push(`Latency p95 ${points} ms (baseline / failure / recovery)`);
  }
  return lines.join('\n');
}

export function planText(plan: PlanSummary): string {
  const lines = [`*Plan${plan.layout ? ` — ${plan.layout}` : ''}*`];
  const size = [
    plan.steps !== undefined ? `${plan.steps} steps` : '',
    plan.actions?.length ? `${plan.actions.length} actions` : '',
    plan.effortHours !== undefined ? `${plan.effortHours}h effort` : '',
    plan.cutoverDowntimeHours !== undefined ? `${plan.cutoverDowntimeHours}h downtime` : '',
  ].filter(Boolean).join(' · ');
  if (size) lines.push(size);
  const money = [
    plan.monthlyEurNow !== undefined && plan.monthlyEurAfter !== undefined
      ? `${eur(plan.monthlyEurNow)}/mo → ${eur(plan.monthlyEurAfter)}/mo`
      : '',
    plan.availabilityPct !== undefined ? `${plan.availabilityPct}% availability` : '',
  ].filter(Boolean).join(' · ');
  if (money) lines.push(money);
  for (const action of (plan.actions ?? []).slice(0, 3)) {
    lines.push(`• ${action.component}: ${action.action}${action.to ? ` → ${action.to}` : ''}`);
  }
  return lines.join('\n');
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}
