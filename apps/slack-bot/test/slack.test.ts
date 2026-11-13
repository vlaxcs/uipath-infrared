import { describe, it, expect } from 'vitest';
import { BoltSlackClient } from '../src/adapters/slack.js';

describe('Bolt Slack client', () => {
  it('updates a message using the channel id Slack returned when it was posted', async () => {
    const calls: any[] = [];
    const app = {
      client: {
        chat: {
          postMessage: async () => ({ ts: '1.0', channel: 'C123' }),
          update: async (args: any) => { calls.push(args); },
        },
      },
    };
    const client = new BoltSlackClient(app);
    const ts = await client.postMessage('infrared-runs', { text: 't', blocks: [] });
    await client.updateMessage('infrared-runs', ts, { text: 't', blocks: [] });
    expect(calls[0]).toMatchObject({ channel: 'C123', ts: '1.0' });
  });
});
