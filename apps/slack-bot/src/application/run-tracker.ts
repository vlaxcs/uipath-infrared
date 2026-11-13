import type { Orchestrator, SlackClient, Wait } from './ports.js';
import type { Gate, Run, RunEvent, RunSummary } from '../domain/run.js';
import { isFinished, summarize } from '../domain/run-summary.js';
import { candidatesOf, targetOf } from '../domain/layout-choice.js';
import { rehearsalOf } from '../domain/rehearsal-summary.js';
import { planOf } from '../domain/plan-summary.js';
import { formatEvent, formatFailedRun, formatGateClosed, formatLayoutGate, formatPlanGate } from '../domain/messages.js';

const GATE_CLOSED_BY: Record<string, Gate> = { pick_layout: 'layout', approve_plan: 'plan' };
const GATE_DECISIONS = new Set(['pick_layout', 'keep_analyses', 'approve_plan']);

export class RunTracker {
  private events: RunEvent[] = [];
  private pending: RunEvent[] = [];
  private gates = new Map<Gate, string>();
  private project = '';

  constructor(
    private slack: SlackClient,
    private orchestrator: Orchestrator,
    private channel: string,
    private wait: Wait,
    private pollMs: number,
    private dashboardUrl?: string
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
    this.project = run.project;
    this.events.push(...run.events.filter(event => event.seq > this.lastSeq()));
    const summary = summarize(this.events);
    const gate = summary.awaiting;
    if (gate) {
      const gateEvent = [...this.events].reverse().find(event => event.status === 'awaiting_approval' && event.gate === gate)!;
      await this.postGate(run.id, gateEvent, this.events.filter(event => event.seq <= gateEvent.seq));
    } else if (summary.status === 'failed') {
      await this.postFailed(this.events);
    } else if (summary.status === 'completed') {
      const approval = [...this.events].reverse().find(event => event.decision?.kind === 'approve_plan');
      if (approval) await this.postClosed(approval);
    } else {
      this.pending = this.events.filter(isThreadWorthy);
    }
    return summary;
  }

  private async apply(run: Run, batch: RunEvent[]): Promise<RunSummary> {
    this.project = run.project;
    for (const event of batch.filter(event => event.seq > this.lastSeq())) {
      this.events.push(event);
      await this.handle(run.id, event);
    }
    return summarize(this.events);
  }

  private async handle(runId: string, event: RunEvent): Promise<void> {
    if (event.status === 'failed') {
      await this.postFailed([...this.pending, event]);
      this.pending = [];
      return;
    }
    if (event.status === 'awaiting_approval' && event.gate) {
      await this.postGate(runId, event, this.pending);
      this.pending = [];
      return;
    }
    if (event.status === 'approved' && event.decision?.kind === 'keep_analyses') {
      const reply = formatEvent(event);
      const ts = this.gates.get('layout');
      if (reply && ts) await this.slack.postMessage(this.channel, reply, ts);
      else if (reply) this.pending.push(event);
      return;
    }
    const closes = event.status === 'approved' ? GATE_CLOSED_BY[event.decision?.kind ?? ''] : undefined;
    if (closes) {
      await this.closeGate(closes, event);
      return;
    }
    if (isThreadWorthy(event)) this.pending.push(event);
  }

  private async postGate(runId: string, gateEvent: RunEvent, history: RunEvent[]): Promise<void> {
    const context = { project: this.project, dashboardUrl: this.dashboardUrl };
    const message = gateEvent.gate === 'plan'
      ? formatPlanGate(runId, gateEvent, this.rehearsalFor(gateEvent), planOf(gateEvent), context)
      : formatLayoutGate(runId, gateEvent, candidatesOf(gateEvent), targetOf(gateEvent), context);
    const ts = await this.slack.postMessage(this.channel, message);
    this.gates.set(gateEvent.gate!, ts);
    for (const event of history) {
      if (event.seq === gateEvent.seq || !isThreadWorthy(event)) continue;
      const reply = formatEvent(event);
      if (reply) await this.slack.postMessage(this.channel, reply, ts);
    }
  }

  private async closeGate(gate: Gate, event: RunEvent): Promise<void> {
    const ts = this.gates.get(gate);
    this.gates.delete(gate);
    const message = formatGateClosed(event, gate === 'plan' ? this.rehearsalFor(event) : undefined);
    if (ts) await this.slack.updateMessage(this.channel, ts, message);
    else await this.postClosed(event);
  }

  private async postClosed(event: RunEvent): Promise<void> {
    const ts = await this.slack.postMessage(this.channel, formatGateClosed(event, this.rehearsalFor(event)));
    for (const earlier of this.events.filter(item => item.seq < event.seq && isThreadWorthy(item))) {
      const reply = formatEvent(earlier);
      if (reply) await this.slack.postMessage(this.channel, reply, ts);
    }
  }

  private async postFailed(events: RunEvent[]): Promise<void> {
    const last = events.at(-1);
    if (!last) return;
    const ts = await this.slack.postMessage(this.channel, formatFailedRun(last));
    for (const event of events.slice(0, -1)) {
      if (!isThreadWorthy(event)) continue;
      const reply = formatEvent(event);
      if (reply) await this.slack.postMessage(this.channel, reply, ts);
    }
  }

  private rehearsalFor(event: RunEvent) {
    return rehearsalOf(event) ?? rehearsalOf(this.lastRehearsal(event.seq));
  }

  private lastRehearsal(beforeSeq?: number): RunEvent | undefined {
    return [...this.events].reverse().find(event =>
      event.step === 'rehearse' && event.status === 'completed' && (beforeSeq === undefined || event.seq < beforeSeq)
    );
  }

  private lastSeq(): number {
    return this.events.at(-1)?.seq ?? 0;
  }
}

function isThreadWorthy(event: RunEvent): boolean {
  if (event.status === 'started') return false;
  if (event.gate) return false;
  if (event.decision && GATE_DECISIONS.has(event.decision.kind)) return false;
  return true;
}
