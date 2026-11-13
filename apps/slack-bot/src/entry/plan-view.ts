import type { PlanApprover } from '../application/plan-approver.js';
import type { PlanApprovalMetadata } from '../domain/approval-view.js';

export function submitPlanApproval(approver: PlanApprover) {
  return async ({ ack, body, view, client }: any): Promise<void> => {
    const metadata = JSON.parse(view.private_metadata) as PlanApprovalMetadata;
    const note = (view.state?.values?.note?.reason?.value ?? '').trim();
    const reviewer = body.user.name || body.user.username || body.user.id;
    await ack();
    try {
      await approver.approve(metadata.run_id, reviewer, note || undefined);
    } catch (error) {
      if (metadata.channel_id) {
        await client.chat.postEphemeral({
          channel: metadata.channel_id,
          user: body.user.id,
          text: `The plan approval was not recorded: ${(error as Error).message}`,
        });
      }
    }
  };
}
