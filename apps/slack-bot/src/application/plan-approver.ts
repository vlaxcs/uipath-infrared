import type { Orchestrator } from './ports.js';
import type { RunEvent } from '../domain/run.js';
import { planApprovalFromSlack } from '../domain/plan-approval.js';

export class PlanApprover {
  constructor(private orchestrator: Orchestrator) {}

  approve(runId: string, reviewer: string, reason?: string): Promise<RunEvent> {
    return this.orchestrator.submitDecision(runId, planApprovalFromSlack(reviewer, reason));
  }
}
