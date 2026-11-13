import { describe, it, expect } from 'vitest';
import { candidatesOf, layoutChoiceFromSlack } from '../src/domain/layout-choice.js';
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
    expect(candidates[0]).toEqual({ id: 'consolidate', feasible: true, rank: 1, monthlyEur: 74365, availabilityPct: 99.95, risk: 0.31 });
    expect(candidates.slice(3).every(candidate => !candidate.feasible)).toBe(true);
  });

  it('ignores candidates without an id and treats a missing feasible flag as feasible', () => {
    expect(candidatesOf(gate([{ id: 'managed_services' }, { rank: 2 }, 'managed_services']))).toEqual([{ id: 'managed_services', feasible: true }]);
  });

  it('returns nothing when the gate carries no extension', () => {
    expect(candidatesOf(sampleEvent(13))).toEqual([]);
    expect(candidatesOf(gate('managed_services'))).toEqual([]);
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
