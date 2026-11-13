import type { Orchestrator, SlackClient, Wait } from './ports.js';
import type { Gate, Run, RunEvent, RunSummary } from '../domain/run.js';
import { isFinished, summarize } from '../domain/run-summary.js';
import { candidatesOf } from '../domain/layout-choice.js';
import { formatEvent, formatGateClosed, formatLayoutGate, formatPlanGate, formatRunHeader } from '../domain/messages.js';

const GATE_CLOSED_BY: Record<string, Gate> = { pick_layout: 'layout', approve_plan: 'plan' };

export class RunTracker {
  private events: RunEvent[] = [];
  private gateMessages = new Map<Gate, string>();
  private headerTs = '';

  constructor(
    private slack: SlackClient,
    private orchestrator: Orchestrator,
    private channel: string,
    private wait: Wait,
    private pollMs: number
  ) {}

  async track(runId: string): Promise<RunSummary> {
    const run = await this.orchestrator.getRun(runId);
    let summary = await this.replay(run);
    while (!isFinished(summary.status)) {
      const fresh = await this.orchestrator.eventsAfter(runId, this.lastSeq());
      if (fresh.length === 0) {
        await this.wait(this.pollMs);
        continue;
      }
      summary = await this.apply(run, fresh);
    }
    return summary;
  }

  async replay(run: Run): Promise<RunSummary> {
    this.headerTs = await this.slack.postMessage(this.channel, formatRunHeader(run, run));
    return this.apply(run, run.events);
  }

  private async apply(run: Run, batch: RunEvent[]): Promise<RunSummary> {
    for (const event of batch.filter(event => event.seq > this.lastSeq())) {
      this.events.push(event);
      await this.post(run.id, event);
    }
    const summary = summarize(this.events);
    await this.slack.updateMessage(this.channel, this.headerTs, formatRunHeader(run, summary));
    return summary;
  }

  private async post(runId: string, event: RunEvent): Promise<void> {
    if (event.status === 'awaiting_approval' && event.gate) {
      const message = event.gate === 'plan' ? formatPlanGate(runId, event, this.lastRehearsal()) : formatLayoutGate(runId, event, candidatesOf(event));
      this.gateMessages.set(event.gate, await this.slack.postMessage(this.channel, message));
      return;
    }
    const closes = event.status === 'approved' ? GATE_CLOSED_BY[event.decision?.kind ?? ''] : undefined;
    if (closes) {
      await this.closeGate(closes, event);
      return;
    }
    const message = formatEvent(event);
    if (message) await this.slack.postMessage(this.channel, message);
  }

  private async closeGate(gate: Gate, event: RunEvent): Promise<void> {
    const message = formatGateClosed(event, gate === 'plan' ? this.lastRehearsal() : undefined);
    const ts = this.gateMessages.get(gate);
    this.gateMessages.delete(gate);
    if (ts) await this.slack.updateMessage(this.channel, ts, message);
    else await this.slack.postMessage(this.channel, message);
  }

  private lastRehearsal(): RunEvent | undefined {
    return [...this.events].reverse().find(event => event.step === 'rehearse' && event.status === 'completed');
  }

  private lastSeq(): number {
    return this.events.at(-1)?.seq ?? 0;
  }
}
