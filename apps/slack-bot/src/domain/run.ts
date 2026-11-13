export type Step = 'extract' | 'investigate' | 'propose' | 'evaluate' | 'present' | 'rehearse';

export type RunStatus = 'running' | 'awaiting_approval' | 'completed' | 'failed';

export type EventStatus = 'started' | 'completed' | 'failed' | 'awaiting_approval' | 'approved';

export type Gate = 'layout' | 'plan';

export type Surface = 'dashboard' | 'slack';

export type DecisionKind = 'proceed' | 'revise' | 'stop' | 'keep_analyses' | 'pick_layout' | 'approve_plan';

export interface ContractFile {
  path: string;
  sha256: string;
}

export type Actor = { kind: 'orchestrator' } | { kind: 'human'; id: string; surface: Surface };

export interface Decision {
  kind: DecisionKind;
  reason: string;
  analyses?: string[];
  layout?: string;
}

export interface RunEvent {
  seq: number;
  at: string;
  step: Step;
  status: EventStatus;
  revision: number;
  actor: Actor;
  gate?: Gate;
  decision?: Decision;
  output?: { contract: 'infra' | 'result' | 'rehearsal'; file: ContractFile };
}

export interface RunSummary {
  status: RunStatus;
  step: Step;
  revision: number;
  started_at: string;
  updated_at: string;
  finished_at?: string;
  awaiting?: Gate;
}

export interface Run extends RunSummary {
  schema_version: string;
  id: string;
  project: string;
  max_revisions: number;
  inputs: { forecast: ContractFile; catalog: ContractFile };
  events: RunEvent[];
}

export interface HumanDecision {
  step: Step;
  status: 'approved';
  actor: Extract<Actor, { kind: 'human' }>;
  decision: Decision;
}
