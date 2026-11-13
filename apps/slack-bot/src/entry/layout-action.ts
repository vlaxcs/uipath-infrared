import type { LayoutPicker } from '../application/layout-picker.js';
import type { LayoutActionValue } from '../domain/messages.js';

export function pickLayoutAction(picker: LayoutPicker) {
  return async ({ body, ack, client }: any): Promise<void> => {
    await ack();
    const { run_id, layout } = JSON.parse(body.actions[0].value) as LayoutActionValue;
    const reviewer = body.user.name || body.user.username || body.user.id;
    try {
      await picker.pick(run_id, layout, reviewer);
    } catch (error) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `The layout pick was not recorded: ${(error as Error).message}`,
      });
    }
  };
}
