import type { Orchestrator } from '../application/ports.js';
import type { PlanActionValue } from '../domain/messages.js';
import { planApprovalView } from '../domain/approval-view.js';
import { rehearsalOf } from '../domain/rehearsal-summary.js';
import { planOf } from '../domain/plan-summary.js';

export function approvePlanAction(orchestrator: Orchestrator) {
  return async ({ body, ack, client }: any): Promise<void> => {
    await ack();
    const { run_id, seq } = JSON.parse(body.actions[0].value) as PlanActionValue;
    try {
      const run = await orchestrator.getRun(run_id);
      const gate = run.events.find(event => event.seq === seq && event.gate === 'plan');
      if (!gate) throw new Error('the plan gate is no longer open');
      const completed = [...run.events].reverse().find(event => event.step === 'rehearse' && event.status === 'completed' && event.seq < seq);
      await client.views.open({
        trigger_id: body.trigger_id,
        view: planApprovalView(run_id, gate, rehearsalOf(gate) ?? rehearsalOf(completed), planOf(gate), body.channel?.id),
      });
    } catch (error) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `Could not open the approval: ${(error as Error).message}`,
      });
    }
  };
}
