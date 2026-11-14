import type { ListedRun } from '../application/run-watcher.js';
import type { Orchestrator } from '../application/ports.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';

export class HttpOrchestrator implements Orchestrator {
  constructor(private baseUrl: string) {}

  listRuns(): Promise<ListedRun[]> {
    return this.request<ListedRun[]>('/runs?limit=50');
  }

  getRun(runId: string): Promise<Run> {
    return this.request<Run>(`/runs/${encodeURIComponent(runId)}`);
  }

  eventsAfter(runId: string, seq: number): Promise<RunEvent[]> {
    return this.request<RunEvent[]>(`/runs/${encodeURIComponent(runId)}/events?after=${seq}`);
  }

  submitDecision(runId: string, decision: HumanDecision): Promise<RunEvent> {
    return this.request<RunEvent>(`/runs/${encodeURIComponent(runId)}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision),
    });
  }

  async getFile(runId: string, path: string): Promise<string> {
    const route = `/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(path)}`;
    const response = await fetch(`${this.baseUrl}${route}`);
    if (!response.ok) throw new Error(`GET ${route} answered ${response.status} ${(await response.text()).slice(0, 200)}`);
    return response.text();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    return response.json() as Promise<T>;
  }
}
