import type { BlockKitMessage } from './messages.js';
import { clip } from './format.js';

export interface DiagramRef {
  fileId: string;
  title: string;
  caption: string;
  alt: string;
}

const CAPTION_BLOCK = 'diagram_caption';
const TEXT_LIMIT = 2000;

export function diagramPlaceholder(dashboardUrl?: string): string {
  return dashboardUrl ? 'Diagram unavailable — open Details for the graph' : 'Diagram unavailable';
}

export function diagramBlocks(ref: DiagramRef | undefined, dashboardUrl: string | undefined, key: string): any[] {
  if (!ref) return [placeholderBlock(dashboardUrl)];
  const image = {
    type: 'image',
    slack_file: { id: ref.fileId },
    alt_text: clip(ref.alt || ref.title || 'Infrastructure diagram', TEXT_LIMIT),
    title: { type: 'plain_text', text: clip(ref.title || 'Infrastructure diagram', TEXT_LIMIT) },
  };
  if (!ref.caption) return [image];
  const caption = { type: 'context', block_id: `${CAPTION_BLOCK}_${key}`, elements: [{ type: 'mrkdwn', text: clip(escape(ref.caption), TEXT_LIMIT) }] };
  return [image, caption];
}

export function hasDiagrams(message: BlockKitMessage): boolean {
  return message.blocks.some(isImage);
}

export function withoutDiagrams(message: BlockKitMessage, dashboardUrl?: string): BlockKitMessage {
  const blocks = message.blocks
    .filter(block => !isCaption(block))
    .map(block => isImage(block) ? placeholderBlock(dashboardUrl) : block);
  return { ...message, blocks };
}

function placeholderBlock(dashboardUrl?: string) {
  return { type: 'context', elements: [{ type: 'mrkdwn', text: diagramPlaceholder(dashboardUrl) }] };
}

function isImage(block: any): boolean {
  return block?.type === 'image' && block.slack_file !== undefined;
}

function isCaption(block: any): boolean {
  return block?.type === 'context' && typeof block.block_id === 'string' && block.block_id.startsWith(CAPTION_BLOCK);
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
