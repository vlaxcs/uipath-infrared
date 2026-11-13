export type RunStatus = "running" | "awaiting_approval" | "completed" | "failed";
export type EventStatus = "started" | "completed" | "failed" | "awaiting_approval" | "approved";
export type RunStep = "extract" | "investigate" | "propose" | "evaluate" | "present" | "rehearse";

export type RunFile = {
  path: string;
  sha256: string;
};

export type Run = {
  id: string;
  project: string;
  status: RunStatus;
  step: RunStep;
  revision: number;
  max_revisions: number;
  started_at: string;
  updated_at: string;
  finished_at?: string;
  inputs: {
    forecast: RunFile;
    catalog: RunFile;
  };
};
