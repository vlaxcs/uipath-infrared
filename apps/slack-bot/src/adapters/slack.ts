import type { BlockKitMessage } from '../domain/messages.js';
import type { SlackClient } from '../application/ports.js';

export class BoltSlackClient implements SlackClient {
  private channelIds = new Map<string, string>();

  constructor(private app: any) {}

  async postMessage(channel: string, message: BlockKitMessage): Promise<string> {
    const result = await this.app.client.chat.postMessage({
      channel,
      ...message,
    });
    this.channelIds.set(channel, result.channel as string);
    return result.ts as string;
  }

  async updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void> {
    await this.app.client.chat.update({
      channel: this.channelIds.get(channel) ?? channel,
      ts: timestamp,
      ...message,
    });
  }
}

export class FakeSlackClient implements SlackClient {
  public messages: Array<{ channel: string; message: BlockKitMessage; timestamp: string }> = [];
  public updates: Array<{ channel: string; timestamp: string; message: BlockKitMessage }> = [];
  private nextTimestamp = 1000;

  async postMessage(channel: string, message: BlockKitMessage): Promise<string> {
    const timestamp = `${this.nextTimestamp++}`;
    this.messages.push({ channel, message, timestamp });
    return timestamp;
  }

  async updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void> {
    this.updates.push({ channel, timestamp, message });
  }

  finalMessages(): BlockKitMessage[] {
    return this.messages.map(posted => this.updates.filter(update => update.timestamp === posted.timestamp).at(-1)?.message ?? posted.message);
  }

  reset(): void {
    this.messages = [];
    this.updates = [];
    this.nextTimestamp = 1000;
  }
}
