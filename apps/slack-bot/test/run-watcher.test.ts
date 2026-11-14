import { describe, it, expect, vi } from 'vitest';
import { RunWatcher } from '../src/application/run-watcher.js';
import type { RunStatus } from '../src/domain/run.js';

type Listed = { id: string; status: RunStatus };

function listing(...polls: Listed[][]) {
  return vi.fn(async () => (polls.length > 1 ? polls.shift()! : polls[0]));
}

describe('the run watcher', () => {
  it('tracks every active run once, and leaves finished runs alone', async () => {
    const listRuns = listing(
      [{ id: 'run-1', status: 'running' }, { id: 'run-0', status: 'completed' }],
      [{ id: 'run-1', status: 'awaiting_approval' }, { id: 'run-2', status: 'running' }, { id: 'run-0', status: 'completed' }],
    );
    const track = vi.fn(async () => undefined);
    const watcher = new RunWatcher(listRuns, track, async () => undefined);
    await watcher.poll();
    await watcher.poll();
    expect(track.mock.calls.map(([id]) => id)).toEqual(['run-1', 'run-2']);
  });

  it('keeps watching when one run cannot be tracked, and reports it', async () => {
    const listRuns = listing([{ id: 'run-1', status: 'running' }, { id: 'run-2', status: 'running' }]);
    const failures: string[] = [];
    const track = vi.fn(async (id: string) => {
      if (id === 'run-1') throw new Error('run-1 not found');
    });
    const watcher = new RunWatcher(listRuns, track, async () => undefined, (id, error) => failures.push(`${id}: ${error.message}`));
    await watcher.poll();
    await vi.waitFor(() => expect(failures).toEqual(['run-1: run-1 not found']));
    expect(track).toHaveBeenCalledWith('run-2');
  });

  it('survives an orchestrator that does not answer, and tries again', async () => {
    const listRuns = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue([{ id: 'run-3', status: 'running' }]);
    const track = vi.fn(async () => undefined);
    const watcher = new RunWatcher(listRuns, track, async () => undefined);
    await watcher.poll();
    await watcher.poll();
    expect(track).toHaveBeenCalledWith('run-3');
  });

  it('polls until it is stopped', async () => {
    const listRuns = listing([]);
    let waits = 0;
    const watcher = new RunWatcher(listRuns, vi.fn(), async () => {
      waits += 1;
      if (waits === 3) watcher.stop();
    });
    await watcher.watch();
    expect(listRuns).toHaveBeenCalledTimes(3);
  });
});
