export type RunStatus = "running" | "awaiting_approval" | "completed" | "failed";
export type EventStatus = "started" | "completed" | "failed" | "awaiting_approval" | "approved";
export type RunStep = "extract" | "investigate" | "propose" | "evaluate" | "present" | "rehearse";
export type StepState = "pending" | "current" | "awaiting" | "done" | "failed";
export type Gate = "layout" | "plan";
export type Surface = "dashboard" | "slack";
export type DecisionKind = "proceed" | "revise" | "stop" | "keep_analyses" | "pick_layout" | "approve_plan";

export type RunFile = {
  path: string;
  sha256: string;
};

export type RunSummary = {
  id: string;
  project: string;
  status: RunStatus;
  step: RunStep;
  revision: number;
  max_revisions: number;
  started_at: string;
  updated_at: string;
  finished_at?: string;
  awaiting?: Gate;
};

export type Run = RunSummary & {
  inputs: {
    forecast: RunFile;
    catalog: RunFile;
  };
};

export type RunActor = { kind: "orchestrator" } | { kind: "human"; id: string; surface: Surface };

export type RunDecision = {
  kind: DecisionKind;
  reason: string;
  analyses?: string[];
  layout?: string;
};

export type RunOutput = {
  contract: "infra" | "result" | "rehearsal";
  file: RunFile;
};

export type LayoutOption = {
  id: string;
  feasible: boolean;
  rank?: number;
  monthly_eur?: number;
  availability_pct?: number;
  risk?: number;
};

export type RunEvent = {
  seq: number;
  at: string;
  step: RunStep;
  status: EventStatus;
  revision: number;
  actor: RunActor;
  gate?: Gate;
  decision?: RunDecision;
  output?: RunOutput;
  x_candidates?: LayoutOption[];
};

export type RunDetail = Run & {
  schema_version: string;
  events: RunEvent[];
};

export type HumanDecision = {
  step: RunStep;
  status: "approved";
  actor: { kind: "human"; id: string; surface: Surface };
  decision: RunDecision;
};

export type RunArtifactInfo = {
  path: string;
  size: number;
};
