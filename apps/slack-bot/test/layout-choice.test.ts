import { describe, it, expect } from 'vitest';
import { candidatesOf, layoutChoiceFromSlack, targetOf } from '../src/domain/layout-choice.js';
import type { RunEvent } from '../src/domain/run.js';
import { sampleEvent } from './sample.js';

function gate(candidates: unknown): RunEvent {
  return { ...sampleEvent(14), x_candidates: candidates } as RunEvent;
}

describe('Layout candidates', () => {
  it('reads the feasible and infeasible candidates off the layout gate', () => {
    const candidates = candidatesOf(sampleEvent(14));
    expect(candidates.map(candidate => candidate.id)).toEqual([
      'consolidate', 'managed_services', 'move_to_onprem', 'rightsize_in_place', 'cleanup_orphans', 'do_nothing',
    ]);
    expect(candidates[0]).toEqual({
      id: 'consolidate', feasible: true, recommended: true, rank: 1, monthlyEur: 74365, horizonEur: 3807488,
      availabilityPct: 99.95, risk: 0.31, effortHours: 794, paybackMonths: 1.38, actions: 21,
    });
    expect(candidates[1].lostBecause).toEqual({
      reason: 'cost',
      detail: 'expected total EUR 4,482,148 over 36 months against EUR 4,078,788 for consolidate',
    });
    expect(candidates.slice(3).every(candidate => !candidate.feasible)).toBe(true);
  });

  it('marks rank 1 as recommended unless the data says otherwise', () => {
    const [rankOne] = candidatesOf(gate([{ id: 'a', feasible: true, rank: 1 }, { id: 'b', feasible: true, rank: 2 }, { id: 'c', feasible: true, rank: 1, recommended: false }]));
    expect(rankOne.recommended).toBe(true);
    expect(candidatesOf(gate([{ id: 'c', feasible: true, rank: 1, recommended: false }]))[0].recommended).toBe(false);
  });

  it('ignores candidates without an id and treats a missing feasible flag as feasible', () => {
    expect(candidatesOf(gate([{ id: 'managed_services' }, { rank: 2 }, 'managed_services']))).toEqual([
      { id: 'managed_services', feasible: true, recommended: false },
    ]);
  });

  it('returns nothing when the gate carries no extension', () => {
    expect(candidatesOf(sampleEvent(13))).toEqual([]);
    expect(candidatesOf(gate('managed_services'))).toEqual([]);
  });

  it('reads the target the run must meet', () => {
    expect(targetOf(sampleEvent(14))).toEqual({ minAvailabilityPct: 99.9, maxMonthlyRunEur: 90000, horizonMonths: 36 });
    expect(targetOf(sampleEvent(13))).toBeUndefined();
  });

  it('builds the pick_layout decision from a Slack click', () => {
    expect(layoutChoiceFromSlack('andrei', 'managed_services')).toEqual({
      step: 'present',
      status: 'approved',
      actor: { kind: 'human', id: 'andrei', surface: 'slack' },
      decision: { kind: 'pick_layout', layout: 'managed_services', reason: 'layout picked from Slack' },
    });
  });
});
