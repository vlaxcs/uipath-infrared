import type { ListedRun } from '../application/run-watcher.js';
import type { Orchestrator } from '../application/ports.js';
import type { HumanDecision, Run, RunEvent } from '../domain/run.js';

export class HttpOrchestrator implements Orchestrator {
  constructor(private baseUrl: string, private serviceToken?: string, private channel?: string) {}

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
    const response = await fetch(`${this.baseUrl}${route}`, this.withToken());
    if (!response.ok) throw new Error(`GET ${route} answered ${response.status} ${(await response.text()).slice(0, 200)}`);
    return response.text();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, this.withToken(init));
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} answered ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    return response.json() as Promise<T>;
  }

  // Names the bot on every request so the dashboard can show that Slack is connected.
  private withToken(init?: RequestInit): RequestInit {
    const headers = new Headers(init?.headers);
    headers.set('X-Infrared-Client', 'slack-bot');
    if (this.channel) headers.set('X-Infrared-Slack-Channel', this.channel);
    if (this.serviceToken) headers.set('Authorization', `Bearer ${this.serviceToken}`);
    return { ...init, headers };
  }
}
