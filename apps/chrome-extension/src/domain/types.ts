export type RunStatus = "running" | "awaiting_approval" | "completed" | "failed";

export type RunStep = "extract" | "investigate" | "propose" | "evaluate" | "present" | "rehearse";

export type Gate = "layout" | "plan";

export type StepState = "pending" | "current" | "awaiting" | "done" | "failed";

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

export type RunActor = { kind: "orchestrator" } | { kind: "human"; id: string; surface: string };

export type RunDecision = {
  kind: string;
  reason: string;
  analyses?: string[];
  layout?: string;
};

export type RunOutput = {
  contract: string;
  file: { path: string; sha256: string };
};

export type RunEvent = {
  seq: number;
  at: string;
  step: RunStep;
  status: "started" | "completed" | "failed" | "awaiting_approval" | "approved";
  revision: number;
  actor: RunActor;
  gate?: Gate;
  decision?: RunDecision;
  output?: RunOutput;
};

export type RunDetail = RunSummary & {
  schema_version: string;
  inputs: {
    forecast: { path: string; sha256: string };
    catalog: { path: string; sha256: string };
  };
  events: RunEvent[];
};

export type RunnerUsage = {
  runnerType: string;
  hours: number;
  workflows: number | null;
};

export type RunnerSuggestion = {
  id: string;
  title: string;
  detail: string;
  runnerType: string;
  hours: number;
  workflows: number | null;
};

export type StepEntry = {
  step: RunStep;
  state: StepState;
};

export type LatestRun = {
  source: "live" | "sample";
  id: string;
  project: string;
  status: RunStatus;
  step: RunStep;
  revision: number;
  maxRevisions: number;
  awaiting?: Gate;
  updatedAt: string;
  before: number | null;
  after: number | null;
  winner: string | null;
  pickedLayout?: string;
  steps: StepEntry[];
  runners: RunnerSuggestion[];
  runnerSourceRepo?: string;
  runnerNote?: string;
  note?: string;
};

export type LatestResponse = {
  run: LatestRun;
  note?: string;
};
