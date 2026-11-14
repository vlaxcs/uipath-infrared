import type { RunStatus } from '../domain/run.js';
import type { Wait } from './ports.js';

export type ListedRun = { id: string; status: RunStatus };
type ListRuns = () => Promise<ListedRun[]>;
type Track = (runId: string) => Promise<unknown>;
type OnFailure = (runId: string, error: Error) => void;

const WATCH_POLL_MS = 3000;
const ACTIVE: ReadonlySet<RunStatus> = new Set<RunStatus>(['running', 'awaiting_approval']);

export class RunWatcher {
  private tracked = new Set<string>();
  private stopped = false;

  constructor(
    private listRuns: ListRuns,
    private track: Track,
    private wait: Wait,
    private onFailure: OnFailure = () => undefined,
    private pollMs = WATCH_POLL_MS
  ) {}

  async watch(): Promise<void> {
    while (!this.stopped) {
      await this.poll();
      await this.wait(this.pollMs);
    }
  }

  stop(): void {
    this.stopped = true;
  }

  async poll(): Promise<void> {
    let runs: ListedRun[];
    try {
      runs = await this.listRuns();
    } catch {
      return;
    }
    for (const run of runs) {
      if (!ACTIVE.has(run.status) || this.tracked.has(run.id)) continue;
      this.tracked.add(run.id);
      this.track(run.id).catch((error: unknown) => this.onFailure(run.id, error instanceof Error ? error : new Error(String(error))));
    }
  }
}
