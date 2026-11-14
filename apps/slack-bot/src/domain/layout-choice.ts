import type { HumanDecision, RunEvent } from './run.js';

export const PICK_LAYOUT_ACTION = 'pick_layout';

export function layoutActionId(layout: string): string {
  return `${PICK_LAYOUT_ACTION}_${layout}`;
}

export interface LostBecause {
  reason: string;
  detail?: string;
}

export interface LayoutCandidate {
  id: string;
  feasible: boolean;
  recommended: boolean;
  rank?: number;
  monthlyEur?: number;
  horizonEur?: number;
  availabilityPct?: number;
  risk?: number;
  effortHours?: number;
  paybackMonths?: number;
  actions?: number;
  lostBecause?: LostBecause;
}

export interface LayoutTarget {
  minAvailabilityPct?: number;
  maxMonthlyRunEur?: number;
  horizonMonths?: number;
}

interface RawCandidate {
  id?: unknown;
  feasible?: unknown;
  recommended?: unknown;
  rank?: unknown;
  monthly_eur?: unknown;
  horizon_eur?: unknown;
  availability_pct?: unknown;
  risk?: unknown;
  effort_hours?: unknown;
  payback_months?: unknown;
  actions?: unknown;
  lost_because?: unknown;
}

interface RawTarget {
  min_availability_pct?: unknown;
  max_monthly_run_eur?: unknown;
  horizon_months?: unknown;
}

export function candidatesOf(event: RunEvent): LayoutCandidate[] {
  const raw = (event as RunEvent & { x_candidates?: unknown }).x_candidates;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCandidate).map(toCandidate);
}

export function targetOf(event: RunEvent): LayoutTarget | undefined {
  const raw = (event as RunEvent & { x_target?: unknown }).x_target;
  if (!isRecord(raw)) return undefined;
  const target: LayoutTarget = {};
  if (typeof raw.min_availability_pct === 'number') target.minAvailabilityPct = raw.min_availability_pct;
  if (typeof raw.max_monthly_run_eur === 'number') target.maxMonthlyRunEur = raw.max_monthly_run_eur;
  if (typeof raw.horizon_months === 'number') target.horizonMonths = raw.horizon_months;
  return Object.keys(target).length > 0 ? target : undefined;
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
  return isRecord(raw) && typeof raw.id === 'string' && raw.id !== '';
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null;
}

function toCandidate(raw: RawCandidate): LayoutCandidate {
  const feasible = raw.feasible !== false;
  const rank = typeof raw.rank === 'number' ? raw.rank : undefined;
  const candidate: LayoutCandidate = {
    id: raw.id as string,
    feasible,
    recommended: raw.recommended === true || (raw.recommended !== false && feasible && rank === 1),
  };
  if (rank !== undefined) candidate.rank = rank;
  if (typeof raw.monthly_eur === 'number') candidate.monthlyEur = raw.monthly_eur;
  if (typeof raw.horizon_eur === 'number') candidate.horizonEur = raw.horizon_eur;
  if (typeof raw.availability_pct === 'number') candidate.availabilityPct = raw.availability_pct;
  if (typeof raw.risk === 'number') candidate.risk = raw.risk;
  if (typeof raw.effort_hours === 'number') candidate.effortHours = raw.effort_hours;
  if (typeof raw.payback_months === 'number') candidate.paybackMonths = raw.payback_months;
  if (typeof raw.actions === 'number') candidate.actions = raw.actions;
  if (isRecord(raw.lost_because) && typeof raw.lost_because.reason === 'string') {
    const lost: LostBecause = { reason: raw.lost_because.reason };
    if (typeof raw.lost_because.detail === 'string') lost.detail = raw.lost_because.detail;
    candidate.lostBecause = lost;
  }
  return candidate;
}
