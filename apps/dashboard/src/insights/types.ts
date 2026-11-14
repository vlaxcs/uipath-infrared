import type { RunSource } from "~/runs/source";
import type { DecisionKind, Gate, RunStatus, RunStep, Surface } from "~/runs/types";

export type InsightReader = Pick<RunSource, "mode" | "listRuns" | "getRun" | "listFiles" | "readArtifact">;

export type RunArtifacts = {
  infra?: unknown;
  findings?: unknown;
  result?: unknown;
  rehearsal?: unknown;
};

export type StepVisit = {
  step: RunStep;
  revision: number;
  start: number;
  end: number;
  state: "done" | "failed" | "current" | "awaiting";
  gate?: Gate;
  gateOpen?: boolean;
};

export type HumanCall = {
  kind: DecisionKind;
  by: string;
  surface: Surface;
  at: number;
  reason: string;
  layout?: string;
};

export type CandidatePoint = {
  id: string;
  source: "engine" | "agent" | "other";
  feasible: boolean;
  monthly: number | null;
  availability: number | null;
  risk: number | null;
  picked: boolean;
  winner: boolean;
};

export type RehearsalOutcome = {
  passed: boolean;
  measured: number | null;
  floor: number | null;
};

export type RunInsight = {
  id: string;
  project: string;
  status: RunStatus;
  awaiting?: Gate;
  startedAt: number;
  endedAt: number;
  visits: StepVisit[];
  revisions: number;
  calls: HumanCall[];
  layout: string | null;
  winner: string | null;
  before: number | null;
  after: number | null;
  availabilityBefore: number | null;
  availabilityAfter: number | null;
  candidates: CandidatePoint[];
  findings: number;
  components: number;
  rehearsal: RehearsalOutcome | null;
  stopReason: string | null;
};

export type ProjectInsight = {
  id: string;
  label: string;
  runs: RunInsight[];
  settled: RunInsight | null;
  before: number | null;
  after: number | null;
  components: number;
  findings: number;
};

export type Pulse = {
  monthlyDelta: number;
  planned: number;
  spend: number;
  projects: number;
  runs: number;
  components: number;
  findings: number;
  candidates: number;
  rehearsals: number;
  calls: number;
};
