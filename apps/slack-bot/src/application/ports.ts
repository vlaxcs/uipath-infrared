import type { BlockKitMessage } from '../domain/messages.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';

export interface SlackClient {
  postMessage(channel: string, message: BlockKitMessage, threadTs?: string): Promise<string>;
  updateMessage(channel: string, timestamp: string, message: BlockKitMessage): Promise<void>;
}

export interface Orchestrator {
  getRun(runId: string): Promise<Run>;
  eventsAfter(runId: string, seq: number): Promise<RunEvent[]>;
  submitDecision(runId: string, decision: HumanDecision): Promise<RunEvent>;
}

export type Wait = (ms: number) => Promise<void>;
