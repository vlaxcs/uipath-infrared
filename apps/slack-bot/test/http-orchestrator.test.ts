import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpOrchestrator } from '../src/adapters/http-orchestrator.js';
import { planApprovalFromSlack } from '../src/domain/plan-approval.js';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('HTTP orchestrator', () => {
  it('polls for the events after the last seq it holds', async () => {
    const fetch = stubFetch(200, [{ seq: 21 }]);
    const events = await new HttpOrchestrator('http://orch').eventsAfter('run-1', 20);
    expect(fetch).toHaveBeenCalledWith('http://orch/runs/run-1/events?after=20', undefined);
    expect(events).toEqual([{ seq: 21 }]);
  });

  it('posts a plan approval shaped like the contract approved event', async () => {
    const fetch = stubFetch(201, { seq: 21 });
    await new HttpOrchestrator('http://orch').submitDecision('run-1', planApprovalFromSlack('andrei'));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://orch/runs/run-1/decisions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      step: 'rehearse',
      status: 'approved',
      actor: { kind: 'human', id: 'andrei', surface: 'slack' },
      decision: { kind: 'approve_plan', reason: 'rehearsal held; plan approved from Slack' },
    });
  });

  it('fails with the status when the orchestrator refuses', async () => {
    stubFetch(409, { error: 'gate plan is not open' });
    await expect(new HttpOrchestrator('http://orch').submitDecision('run-1', planApprovalFromSlack('a'))).rejects.toThrow('409');
  });

  it('reads a run file from the artifact route', async () => {
    const fetch = stubFetch(200, { schema_version: '1.1' });
    expect(await new HttpOrchestrator('http://orch').getFile('run-1', 'result.1.json')).toBe('{"schema_version":"1.1"}');
    expect(fetch).toHaveBeenCalledWith('http://orch/runs/run-1/files/result.1.json');
  });

  it('fails with the status when a run file is missing', async () => {
    stubFetch(404, { error: 'not found' });
    await expect(new HttpOrchestrator('http://orch').getFile('run-1', 'result.9.json')).rejects.toThrow('404');
  });
});
