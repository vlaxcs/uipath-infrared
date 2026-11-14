import type { BlockKitMessage } from '../domain/messages.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';

export interface SlackClient {
  postMessage(channel: string, message: BlockKitMessage): Promise<string>;
  updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void>;
  uploadImage(path: string, title: string, alt: string): Promise<string | null>;
}

export interface Orchestrator {
  getRun(runId: string): Promise<Run>;
  eventsAfter(runId: string, seq: number): Promise<RunEvent[]>;
  submitDecision(runId: string, decision: HumanDecision): Promise<RunEvent>;
}

export type DiagramState = 'current' | 'target';

export interface DiagramRequest {
  layout: string;
  state: DiagramState;
}

export interface Diagram {
  pngPath: string;
  title: string;
  caption: string;
  alt: string;
}

export interface DiagramRenderer {
  render(request: DiagramRequest): Promise<Diagram | null>;
}

export type Wait = (ms: number) => Promise<void>;
