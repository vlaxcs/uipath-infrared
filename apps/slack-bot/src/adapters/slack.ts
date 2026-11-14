import { basename } from 'path';
import type { BlockKitMessage } from '../domain/messages.js';
import type { SlackClient, Wait } from '../application/ports.js';
import { hasDiagrams, withoutDiagrams } from '../domain/diagram.js';
import { clip } from '../domain/format.js';

const TEXT_LIMIT = 2000;
const IMAGE_RETRIES = 2;
const RETRY_MS = 1500;

export interface BoltSlackOptions {
  dashboardUrl?: string;
  wait?: Wait;
}

export class BoltSlackClient implements SlackClient {
  private channelIds = new Map<string, string>();
  private fileIds = new Map<string, Promise<string | null>>();
  private reported = new Set<string>();
  private wait: Wait;

  constructor(private app: any, private options: BoltSlackOptions = {}) {
    this.wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  async postMessage(channel: string, message: BlockKitMessage): Promise<string> {
    const result = await this.sendWithImages(message, body => this.app.client.chat.postMessage({ channel, ...body }));
    this.channelIds.set(channel, result.channel as string);
    return result.ts as string;
  }

  async updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void> {
    await this.sendWithImages(message, body => this.app.client.chat.update({
      channel: this.channelIds.get(channel) ?? channel,
      ts: timestamp,
      ...body,
    }));
  }

  uploadImage(path: string, title: string, alt: string): Promise<string | null> {
    let pending = this.fileIds.get(path);
    if (!pending) {
      pending = this.upload(path, title, alt);
      this.fileIds.set(path, pending);
    }
    return pending;
  }

  private async upload(path: string, title: string, alt: string): Promise<string | null> {
    try {
      const result = await this.app.client.files.uploadV2({
        file: path,
        filename: basename(path),
        title: clip(title, TEXT_LIMIT),
        alt_text: clip(alt, TEXT_LIMIT),
      });
      const id = result?.files?.[0]?.files?.[0]?.id;
      if (typeof id !== 'string') throw new Error('Slack returned no file id');
      return id;
    } catch (error) {
      this.report(uploadFailure(path, error));
      this.fileIds.delete(path);
      return null;
    }
  }

  private report(line: string): void {
    if (this.reported.has(line)) return;
    this.reported.add(line);
    console.error(line);
  }

  private async sendWithImages(message: BlockKitMessage, send: (body: BlockKitMessage) => Promise<any>): Promise<any> {
    if (!hasDiagrams(message)) return send(message);
    for (let attempt = 0; attempt <= IMAGE_RETRIES; attempt++) {
      try {
        return await send(message);
      } catch (error) {
        if (slackError(error) !== 'invalid_blocks') throw error;
        if (attempt < IMAGE_RETRIES) await this.wait(RETRY_MS * (attempt + 1));
      }
    }
    console.error('Slack rejected the diagram blocks; sending the card with the diagram placeholder');
    return send(withoutDiagrams(message, this.options.dashboardUrl));
  }
}

export class FakeSlackClient implements SlackClient {
  public messages: Array<{ channel: string; message: BlockKitMessage; timestamp: string }> = [];
  public updates: Array<{ channel: string; timestamp: string; message: BlockKitMessage }> = [];
  public uploads: Array<{ path: string; title: string; alt: string; fileId: string }> = [];
  private nextTimestamp = 1000;

  async postMessage(channel: string, message: BlockKitMessage): Promise<string> {
    const timestamp = `${this.nextTimestamp++}`;
    this.messages.push({ channel, message, timestamp });
    return timestamp;
  }

  async updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void> {
    this.updates.push({ channel, timestamp, message });
  }

  async uploadImage(path: string, title: string, alt: string): Promise<string | null> {
    const known = this.uploads.find(upload => upload.path === path);
    if (known) return known.fileId;
    const fileId = `F${String(this.uploads.length + 1).padStart(4, '0')}`;
    this.uploads.push({ path, title, alt, fileId });
    return fileId;
  }

  finalMessages(): BlockKitMessage[] {
    return this.messages.map(posted => this.updates.filter(update => update.timestamp === posted.timestamp).at(-1)?.message ?? posted.message);
  }

  reset(): void {
    this.messages = [];
    this.updates = [];
    this.uploads = [];
    this.nextTimestamp = 1000;
  }
}

function slackError(error: unknown): string | undefined {
  return (error as { data?: { error?: string } })?.data?.error;
}

function uploadFailure(path: string, error: unknown): string {
  const code = slackError(error);
  if (code === 'missing_scope') return 'Diagram upload failed: the Slack app needs the files:write scope; cards show the diagram placeholder';
  return `Diagram upload failed for ${basename(path)}: ${code ?? (error as Error).message}`;
}
