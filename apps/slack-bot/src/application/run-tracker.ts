import type { DiagramInputs, DiagramRenderer, Orchestrator, SlackClient, Wait } from './ports.js';
import { DiagramPublisher } from './diagram-publisher.js';
import type { Gate, Run, RunEvent, RunSummary } from '../domain/run.js';
import type { RunContext } from '../domain/messages.js';
import { isFinished, summarize } from '../domain/run-summary.js';
import { candidatesOf, targetOf } from '../domain/layout-choice.js';
import { rehearsalOf } from '../domain/rehearsal-summary.js';
import { planOf } from '../domain/plan-summary.js';
import {
  formatFailedRun, formatGateClosed, formatLayoutDone, formatLayoutGate, formatLayoutProgress, formatLayoutStopped, formatPlanGate,
} from '../domain/messages.js';

const NO_DIAGRAMS: DiagramRenderer = { render: async () => null };

const GATE_CLOSED_BY: Record<string, Gate> = { pick_layout: 'layout', approve_plan: 'plan' };

export class RunTracker {
  private events: RunEvent[] = [];
  private gates = new Map<Gate, string>();
  private project = '';
  private runId = '';
  private layoutCardTs = '';
  private layoutPick?: RunEvent;
  private progressFrame = 0;
  private progressActive = false;
  private diagrams: DiagramPublisher;

  constructor(
    private slack: SlackClient,
    private orchestrator: Orchestrator,
    private channel: string,
    private wait: Wait,
    private pollMs: number,
    private dashboardUrl?: string,
    renderer: DiagramRenderer = NO_DIAGRAMS
  ) {
    this.diagrams = new DiagramPublisher(renderer, slack);
  }

  async track(runId: string): Promise<RunSummary> {
    const run = await this.orchestrator.getRun(runId);
    let summary = await this.replay(run);
    while (!isFinished(summary.status)) {
      const fresh = await this.orchestrator.eventsAfter(runId, this.lastSeq());
      if (fresh.length === 0) {
        await this.tickProgress();
        await this.wait(this.pollMs);
        continue;
      }
      summary = await this.apply(run, fresh);
    }
    return summary;
  }

  async replay(run: Run): Promise<RunSummary> {
    this.project = run.project;
    this.runId = run.id;
    this.events.push(...run.events.filter(event => event.seq > this.lastSeq()));
    const summary = summarize(this.events);
    const gate = summary.awaiting;
    if (gate) {
      const gateEvent = [...this.events].reverse().find(event => event.status === 'awaiting_approval' && event.gate === gate)!;
      await this.postGate(run.id, gateEvent);
    } else if (summary.status === 'failed') {
      await this.postFailed(this.events.at(-1));
    } else if (summary.status === 'completed') {
      const approval = [...this.events].reverse().find(event => event.decision?.kind === 'approve_plan');
      if (approval) await this.slack.postMessage(this.channel, await this.closedMessage('plan', approval));
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
    if (event.step === 'rehearse' && event.status === 'started') {
      await this.startProgress();
      return;
    }
    if (event.step === 'rehearse' && event.status === 'completed') await this.finishProgress(event);
    if (event.status === 'failed') {
      await this.stopProgress();
      await this.postFailed(event);
      return;
    }
    if (event.status === 'awaiting_approval' && event.gate) {
      await this.postGate(runId, event);
      return;
    }
    const closes = event.status === 'approved' ? GATE_CLOSED_BY[event.decision?.kind ?? ''] : undefined;
    if (closes) await this.closeGate(closes, event);
  }

  private async postGate(runId: string, gateEvent: RunEvent): Promise<void> {
    const message = gateEvent.gate === 'plan' ? await this.planCard(runId, gateEvent) : await this.layoutCard(runId, gateEvent);
    const ts = await this.slack.postMessage(this.channel, message);
    this.gates.set(gateEvent.gate!, ts);
    if (gateEvent.gate === 'layout') this.layoutCardTs = ts;
  }

  private async layoutCard(runId: string, gateEvent: RunEvent) {
    const candidates = candidatesOf(gateEvent);
    const offered = candidates.filter(candidate => candidate.feasible).map(candidate => candidate.id);
    const diagrams = await this.diagrams.publishAll(offered, this.inputs());
    return formatLayoutGate(runId, gateEvent, candidates, targetOf(gateEvent), this.context(), diagrams);
  }

  private async planCard(runId: string, gateEvent: RunEvent) {
    const diagram = await this.diagrams.publish(this.planLayout(gateEvent), this.inputs());
    return formatPlanGate(runId, gateEvent, this.rehearsalFor(gateEvent), planOf(gateEvent), this.context(), diagram);
  }

  private async closedMessage(gate: Gate, event: RunEvent) {
    if (gate === 'layout') return formatGateClosed(event, undefined, await this.diagrams.publish(event.decision?.layout, this.inputs()), this.context());
    const diagram = await this.diagrams.publish(this.planLayout(this.lastPlanGate(event.seq)), this.inputs());
    return formatGateClosed(event, this.rehearsalFor(event), diagram, this.context());
  }

  private async closeGate(gate: Gate, event: RunEvent): Promise<void> {
    const ts = this.gates.get(gate);
    this.gates.delete(gate);
    if (gate === 'layout') {
      this.layoutPick = event;
      this.progressActive = false;
    }
    const message = await this.closedMessage(gate, event);
    if (ts) {
      if (gate === 'layout') this.layoutCardTs = ts;
      await this.slack.updateMessage(this.channel, ts, message);
    } else {
      await this.slack.postMessage(this.channel, message);
    }
  }

  private async startProgress(): Promise<void> {
    if (!this.layoutCardTs || !this.layoutPick) return;
    this.progressFrame = 0;
    this.progressActive = true;
    await this.slack.updateMessage(this.channel, this.layoutCardTs, formatLayoutProgress(this.layoutPick, this.progressFrame, await this.pickDiagram(), this.context()));
  }

  private async tickProgress(): Promise<void> {
    if (!this.progressActive || !this.layoutPick || !this.layoutCardTs) return;
    this.progressFrame = (this.progressFrame + 1) % 8;
    await this.slack.updateMessage(this.channel, this.layoutCardTs, formatLayoutProgress(this.layoutPick, this.progressFrame, await this.pickDiagram(), this.context()));
  }

  private async finishProgress(event: RunEvent): Promise<void> {
    if (!this.progressActive || !this.layoutPick || !this.layoutCardTs) return;
    this.progressActive = false;
    await this.slack.updateMessage(this.channel, this.layoutCardTs, formatLayoutDone(this.layoutPick, rehearsalOf(event), await this.pickDiagram(), this.context()));
  }

  private async stopProgress(): Promise<void> {
    if (!this.progressActive || !this.layoutPick || !this.layoutCardTs) return;
    this.progressActive = false;
    await this.slack.updateMessage(this.channel, this.layoutCardTs, formatLayoutStopped(this.layoutPick, eventReason(this.events.at(-1)), await this.pickDiagram(), this.context()));
  }

  private async postFailed(event: RunEvent | undefined): Promise<void> {
    if (event) await this.slack.postMessage(this.channel, formatFailedRun(event));
  }

  private pickDiagram() {
    return this.diagrams.publish(this.layoutPick?.decision?.layout, this.inputs());
  }

  private inputs(): DiagramInputs | undefined {
    const result = this.latestOutput('result');
    const infra = this.latestOutput('infra');
    return result && infra && this.runId ? { runId: this.runId, result, infra } : undefined;
  }

  private latestOutput(contract: 'infra' | 'result'): string | undefined {
    return [...this.events].reverse().find(item => item.output?.contract === contract)?.output?.file.path;
  }

  private planLayout(planGate: RunEvent | undefined): string | undefined {
    return planOf(planGate)?.layout ?? this.pickedLayout();
  }

  private pickedLayout(): string | undefined {
    return [...this.events].reverse().find(item => item.decision?.kind === 'pick_layout')?.decision?.layout;
  }

  private lastPlanGate(beforeSeq: number): RunEvent | undefined {
    return [...this.events].reverse().find(item => item.gate === 'plan' && item.status === 'awaiting_approval' && item.seq < beforeSeq);
  }

  private context(): RunContext {
    return { project: this.project, dashboardUrl: this.dashboardUrl };
  }

  private rehearsalFor(event: RunEvent) {
    return rehearsalOf(event) ?? rehearsalOf(this.lastRehearsal(event.seq));
  }

  private lastRehearsal(beforeSeq?: number): RunEvent | undefined {
    return [...this.events].reverse().find(item =>
      item.step === 'rehearse' && item.status === 'completed' && (beforeSeq === undefined || item.seq < beforeSeq)
    );
  }

  private lastSeq(): number {
    return this.events.at(-1)?.seq ?? 0;
  }
}

function eventReason(event: RunEvent | undefined): string | undefined {
  return event?.decision?.reason;
}
