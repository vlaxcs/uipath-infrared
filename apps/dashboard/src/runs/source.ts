import type { RunEvent } from "~/runs/types";

export type RunSource = {
  eventsAfter(runId: string, after: number, signal?: AbortSignal): Promise<RunEvent[]>;
};
