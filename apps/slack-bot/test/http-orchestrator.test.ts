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

  it('lists the runs to watch, newest first', async () => {
    const fetch = stubFetch(200, [{ id: 'run-2', status: 'running' }]);
    const runs = await new HttpOrchestrator('http://orch').listRuns();
    expect(fetch).toHaveBeenCalledWith('http://orch/runs?limit=50', undefined);
    expect(runs).toEqual([{ id: 'run-2', status: 'running' }]);
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

  it('sends the service token on reads and on decisions when it has one', async () => {
    const fetch = stubFetch(200, []);
    const orchestrator = new HttpOrchestrator('http://orch', 'service-token');
    await orchestrator.listRuns();
    await orchestrator.submitDecision('run-1', planApprovalFromSlack('a'));
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(new Headers(calls[0][1].headers).get('Authorization')).toBe('Bearer service-token');
    const decision = new Headers(calls[1][1].headers);
    expect(decision.get('Authorization')).toBe('Bearer service-token');
    expect(decision.get('Content-Type')).toBe('application/json');
  });

  it('fails with the status when the orchestrator refuses', async () => {
    stubFetch(409, { error: 'gate plan is not open' });
    await expect(new HttpOrchestrator('http://orch').submitDecision('run-1', planApprovalFromSlack('a'))).rejects.toThrow('409');
  });
});
