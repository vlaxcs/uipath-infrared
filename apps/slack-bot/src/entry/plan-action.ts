import type { PlanApprover } from '../application/plan-approver.js';
import type { PlanActionValue } from '../domain/messages.js';

export function approvePlanAction(approver: PlanApprover) {
  return async ({ body, ack, client }: any): Promise<void> => {
    await ack();
    const { run_id } = JSON.parse(body.actions[0].value) as PlanActionValue;
    const reviewer = body.user.name || body.user.username || body.user.id;
    try {
      await approver.approve(run_id, reviewer);
    } catch (error) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `The plan approval was not recorded: ${(error as Error).message}`,
      });
    }
  };
}
