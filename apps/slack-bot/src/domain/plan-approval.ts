import type { HumanDecision } from './run.js';

export const APPROVE_PLAN_ACTION = 'approve_plan';

export const SLACK_APPROVAL_REASON = 'rehearsal held; plan approved from Slack';

export function planApprovalFromSlack(reviewer: string): HumanDecision {
  return {
    step: 'rehearse',
    status: 'approved',
    actor: { kind: 'human', id: reviewer, surface: 'slack' },
    decision: { kind: 'approve_plan', reason: SLACK_APPROVAL_REASON },
  };
}
