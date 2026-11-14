import { readFile } from 'fs/promises';
import type { Orchestrator, Wait } from '../application/ports.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';
import { candidatesOf } from '../domain/layout-choice.js';
import type { LayoutCandidate } from '../domain/layout-choice.js';
import { summarize } from '../domain/run-summary.js';

export class SampleOrchestrator implements Orchestrator {
  private events: RunEvent[];
  private tail: RunEvent[];
  private released = 1;

  constructor(
    private run: Run,
    tail: RunEvent[],
    private wait: Wait,
    private paceMs: number,
    private clock: () => Date,
    private files: Record<string, string> = {}
  ) {
    this.events = [...run.events];
    this.tail = [...tail];
  }

  async getRun(runId: string): Promise<Run> {
    this.requireRun(runId);
    return this.compose(this.released);
  }

  async eventsAfter(runId: string, seq: number): Promise<RunEvent[]> {
    this.requireRun(runId);
    if (this.released < this.events.length) {
      await this.wait(this.paceMs);
      this.released += 1;
    }
    return this.events.slice(0, this.released).filter(event => event.seq > seq);
  }

  async submitDecision(runId: string, decision: HumanDecision): Promise<RunEvent> {
    this.requireRun(runId);
    if (this.released < this.events.length) throw new Error(`run ${runId} is not waiting at a gate`);
    const gate = summarize(this.events).awaiting;
    if (!gate) throw new Error(`run ${runId} is not waiting at a gate`);
    if (gate === 'layout') this.requireLayoutChoice(runId, decision);
    if (gate === 'plan' && decision.decision.kind !== 'approve_plan') throw new Error(`run ${runId} is waiting for a plan approval`);
    const event = this.humanEvent(decision);
    this.events.push(event);
    this.released = this.events.length;
    if (gate === 'layout') this.appendTail(decision.decision.layout ?? '');
    return event;
  }

  async getFile(runId: string, path: string): Promise<string> {
    this.requireRun(runId);
    const source = this.files[path];
    if (!source) throw new Error(`run ${runId} has no file ${path}`);
    return readFile(source, 'utf8');
  }

  document(): Run {
    return this.compose(this.events.length);
  }

  private requireLayoutChoice(runId: string, decision: HumanDecision): void {
    if (decision.decision.kind !== 'pick_layout') throw new Error(`run ${runId} is waiting for a layout choice`);
    const layout = decision.decision.layout ?? '';
    if (!this.offeredLayouts().includes(layout)) throw new Error(`layout ${layout} is not offered by run ${runId}`);
  }

  private offeredLayouts(): string[] {
    return this.events
      .flatMap(event => candidatesOf(event))
      .filter(candidate => candidate.feasible)
      .map(candidate => candidate.id);
  }

  private appendTail(chosen: string): void {
    const candidate = this.events.flatMap(event => candidatesOf(event)).find(item => item.id === chosen);
    const scripted = this.tail;
    this.tail = [];
    let previous = this.events.at(-1)!.at;
    let seq = this.events.at(-1)!.seq;
    for (const event of scripted) {
      const at = Date.parse(event.at) > Date.parse(previous) ? event.at : this.after(previous);
      previous = at;
      const next = { ...event, seq: ++seq, at };
      this.bindPlan(next, chosen, candidate);
      this.events.push(next);
    }
  }

  private bindPlan(event: RunEvent, chosen: string, candidate?: LayoutCandidate): void {
    const plan = (event as RunEvent & { x_plan?: Record<string, unknown> }).x_plan;
    if (!plan) return;
    plan.layout = chosen;
    if (candidate?.monthlyEur !== undefined) plan.monthly_eur_after = candidate.monthlyEur;
    if (candidate?.effortHours !== undefined) plan.effort_hours = candidate.effortHours;
    if (candidate?.availabilityPct !== undefined) plan.availability_pct = candidate.availabilityPct;
    if (chosen !== 'managed_services') delete plan.actions;
  }

  private humanEvent(decision: HumanDecision): RunEvent {
    const last = this.events[this.events.length - 1];
    return {
      seq: last.seq + 1,
      at: this.after(last.at),
      step: decision.step,
      status: decision.status,
      revision: this.run.revision,
      actor: decision.actor,
      decision: decision.decision,
    };
  }

  private compose(released: number): Run {
    const events = this.events.slice(0, released);
    const { awaiting, finished_at, ...rest } = this.run;
    return { ...rest, ...summarize(events), events };
  }

  private after(previous: string): string {
    const now = this.clock();
    const at = now.getTime() < Date.parse(previous) ? new Date(previous) : now;
    return at.toISOString().replace(/\.\d+Z$/, 'Z');
  }

  private requireRun(runId: string): void {
    if (runId !== this.run.id) throw new Error(`run ${runId} is not the sample run ${this.run.id}`);
  }
}
