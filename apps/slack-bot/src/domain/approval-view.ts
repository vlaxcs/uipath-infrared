import type { RunEvent } from './run.js';
import type { PlanSummary } from './plan-summary.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import { planSentence, rehearsalSentence } from './summary-sentences.js';

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
  const lines = [rehearsalSentence(rehearsal)];
  if (rehearsal.failure) lines.push(rehearsal.failure);
  return lines.join('\n');
}

export function planText(plan: PlanSummary): string {
  const lines = [`*The plan${plan.layout ? ` — ${plan.layout}` : ''}*`, planSentence(plan)];
  for (const action of (plan.actions ?? []).slice(0, 3)) {
    lines.push(`• ${action.component}: ${action.action}${action.to ? ` to ${action.to}` : ''}`);
  }
  return lines.join('\n');
}

function section(text: string) {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}
