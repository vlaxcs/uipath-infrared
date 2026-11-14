import { RunSourceError, type RunSource } from "~/runs/source";
import type {
  HumanDecision,
  RunArtifactInfo,
  RunDetail,
  RunEvent,
  RunSummary,
} from "~/runs/types";

export function createHttpRunSource(baseUrl: string): RunSource {
  const base = baseUrl.replace(/\/+$/, "");

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
    if (!response.ok) throw await errorFrom(response);
    return (await response.json()) as T;
  };

  const text = async (path: string, signal?: AbortSignal): Promise<string> => {
    const response = await fetch(`${base}${path}`, { signal });
    if (!response.ok) throw await errorFrom(response);
    return response.text();
  };

  return {
    mode: "live",
    listRuns: (signal) => request<RunSummary[]>("/runs", { signal }),
    getRun: (id, signal) => request<RunDetail>(`/runs/${encodeURIComponent(id)}`, { signal }),
    startRun: (project, signal) =>
      request<RunDetail>("/runs", {
        method: "POST",
        body: JSON.stringify({ project }),
        signal,
      }),
    eventsAfter: (id, after, signal) =>
      request<RunEvent[]>(`/runs/${encodeURIComponent(id)}/events?after=${after}`, { signal }),
    submitDecision: (id, decision: HumanDecision, signal) =>
      request<RunEvent>(`/runs/${encodeURIComponent(id)}/decisions`, {
        method: "POST",
        body: JSON.stringify(decision),
        signal,
      }),
    listFiles: (id, signal) =>
      request<RunArtifactInfo[]>(`/runs/${encodeURIComponent(id)}/files`, { signal }),
    readArtifact: (id, path, signal) =>
      text(`/runs/${encodeURIComponent(id)}/files/${encodeURIComponent(path)}`, signal),
  };
}

async function errorFrom(response: Response): Promise<RunSourceError> {
  let reason = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") reason = body.error;
  } catch {
    reason = `HTTP ${response.status}`;
  }
  return new RunSourceError(reason, response.status);
}
