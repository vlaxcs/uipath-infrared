import type {
  HumanDecision,
  RunArtifactInfo,
  RunDetail,
  RunEvent,
  RunStep,
  RunSummary,
} from "~/runs/types";

export type RunLogChunk = {
  text: string;
  next: number;
  running: boolean;
};

export type RunSourceMode = "live" | "sample";

export type RunSource = {
  mode: RunSourceMode;
  listRuns(signal?: AbortSignal): Promise<RunSummary[]>;
  getRun(id: string, signal?: AbortSignal): Promise<RunDetail>;
  startRun(project: string, signal?: AbortSignal): Promise<RunDetail>;
  eventsAfter(id: string, after: number, signal?: AbortSignal): Promise<RunEvent[]>;
  submitDecision(id: string, decision: HumanDecision, signal?: AbortSignal): Promise<RunEvent>;
  listFiles(id: string, signal?: AbortSignal): Promise<RunArtifactInfo[]>;
  readArtifact(id: string, path: string, signal?: AbortSignal): Promise<string>;
  readLog(id: string, step: RunStep, after: number, signal?: AbortSignal): Promise<RunLogChunk>;
};

export class RunSourceError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "RunSourceError";
    this.status = status;
  }
}
