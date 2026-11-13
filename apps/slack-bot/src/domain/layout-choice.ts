import type { HumanDecision, RunEvent } from './run.js';

export const PICK_LAYOUT_ACTION = 'pick_layout';

export function layoutActionId(layout: string): string {
  return `${PICK_LAYOUT_ACTION}_${layout}`;
}

export interface LayoutCandidate {
  id: string;
  feasible: boolean;
  rank?: number;
  monthlyEur?: number;
  availabilityPct?: number;
  risk?: number;
}

interface RawCandidate {
  id?: unknown;
  feasible?: unknown;
  rank?: unknown;
  monthly_eur?: unknown;
  availability_pct?: unknown;
  risk?: unknown;
}

export function candidatesOf(event: RunEvent): LayoutCandidate[] {
  const raw = (event as RunEvent & { x_candidates?: unknown }).x_candidates;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCandidate).map(toCandidate);
}

export function layoutChoiceFromSlack(reviewer: string, layout: string): HumanDecision {
  return {
    step: 'present',
    status: 'approved',
    actor: { kind: 'human', id: reviewer, surface: 'slack' },
    decision: { kind: 'pick_layout', layout, reason: 'layout picked from Slack' },
  };
}

function isCandidate(raw: unknown): raw is RawCandidate {
  return typeof raw === 'object' && raw !== null && typeof (raw as RawCandidate).id === 'string' && (raw as RawCandidate).id !== '';
}

function toCandidate(raw: RawCandidate): LayoutCandidate {
  const candidate: LayoutCandidate = { id: raw.id as string, feasible: raw.feasible !== false };
  if (typeof raw.rank === 'number') candidate.rank = raw.rank;
  if (typeof raw.monthly_eur === 'number') candidate.monthlyEur = raw.monthly_eur;
  if (typeof raw.availability_pct === 'number') candidate.availabilityPct = raw.availability_pct;
  if (typeof raw.risk === 'number') candidate.risk = raw.risk;
  return candidate;
}
