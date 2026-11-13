import type { Orchestrator } from './ports.js';
import type { RunEvent } from '../domain/run.js';
import { layoutChoiceFromSlack } from '../domain/layout-choice.js';

export class LayoutPicker {
  constructor(private orchestrator: Orchestrator) {}

  pick(runId: string, layout: string, reviewer: string): Promise<RunEvent> {
    return this.orchestrator.submitDecision(runId, layoutChoiceFromSlack(reviewer, layout));
  }
}
