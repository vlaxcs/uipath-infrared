import type { ListedRun } from '../application/run-watcher.js';
import type { Orchestrator } from '../application/ports.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';

export class HttpOrchestrator implements Orchestrator {
  constructor(private baseUrl: string, private serviceToken?: string) {}

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

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, this.withToken(init));
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    return response.json() as Promise<T>;
  }

  private withToken(init?: RequestInit): RequestInit | undefined {
    if (!this.serviceToken) return init;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${this.serviceToken}`);
    return { ...init, headers };
  }
}
