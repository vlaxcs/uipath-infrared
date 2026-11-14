import { describe, it, expect, vi } from 'vitest';
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

describe('Bolt Slack client diagrams', () => {
  const imageMessage = {
    text: 't',
    blocks: [
      { type: 'image', slack_file: { id: 'F1' }, alt_text: 'a', title: { type: 'plain_text', text: 'x' } },
      { type: 'context', block_id: 'diagram_caption_x', elements: [{ type: 'mrkdwn', text: 'caption' }] },
    ],
  };
  const invalidBlocks = () => Object.assign(new Error('An API error occurred: invalid_blocks'), { data: { error: 'invalid_blocks' } });

  it('uploads privately, without a channel, and reads the file id from the upload result', async () => {
    const uploads: any[] = [];
    const app = { client: { files: { uploadV2: async (args: any) => { uploads.push(args); return { ok: true, files: [{ ok: true, files: [{ id: 'F123' }] }] }; } } } };
    const client = new BoltSlackClient(app);

    expect(await client.uploadImage('/tmp/out/consolidate-target.png', 'Title', 'Alt')).toBe('F123');
    expect(await client.uploadImage('/tmp/out/consolidate-target.png', 'Title', 'Alt')).toBe('F123');
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toEqual({ file: '/tmp/out/consolidate-target.png', filename: 'consolidate-target.png', title: 'Title', alt_text: 'Alt' });
    expect(uploads[0].channel_id).toBeUndefined();
  });

  it('names the files:write scope when the upload is refused for a missing scope', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = { client: { files: { uploadV2: async () => { throw Object.assign(new Error('missing_scope'), { data: { error: 'missing_scope' } }); } } } };
    const client = new BoltSlackClient(app);

    expect(await client.uploadImage('/tmp/a.png', 'T', 'A')).toBeNull();
    expect(error.mock.calls.flat().join(' ')).toContain('files:write');
    error.mockRestore();
  });

  it('retries a just-uploaded image rejected as invalid_blocks, then posts it', async () => {
    let calls = 0;
    const waits: number[] = [];
    const app = { client: { chat: { postMessage: async () => { if (++calls < 3) throw invalidBlocks(); return { ts: '1.0', channel: 'C1' }; } } } };
    const client = new BoltSlackClient(app, { wait: async ms => { waits.push(ms); } });

    expect(await client.postMessage('c', imageMessage)).toBe('1.0');
    expect(calls).toBe(3);
    expect(waits).toHaveLength(2);
  });

  it('falls back to the placeholder after the retries', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sent: any[] = [];
    const app = { client: { chat: { update: async (args: any) => {
      sent.push(args);
      if (args.blocks.some((block: any) => block.type === 'image')) throw invalidBlocks();
    } } } };
    const client = new BoltSlackClient(app, { dashboardUrl: 'https://infrared.local', wait: async () => {} });

    await client.updateMessage('C1', '1.0', imageMessage);
    expect(sent).toHaveLength(4);
    expect(sent.at(-1).blocks).toEqual([{ type: 'context', elements: [{ type: 'mrkdwn', text: 'Diagram unavailable — open Details for the graph' }] }]);
    error.mockRestore();
  });

  it('does not retry other Slack errors', async () => {
    let calls = 0;
    const app = { client: { chat: { postMessage: async () => { calls++; throw Object.assign(new Error('channel_not_found'), { data: { error: 'channel_not_found' } }); } } } };
    const client = new BoltSlackClient(app, { wait: async () => {} });

    await expect(client.postMessage('c', imageMessage)).rejects.toThrow('channel_not_found');
    expect(calls).toBe(1);
  });
});
