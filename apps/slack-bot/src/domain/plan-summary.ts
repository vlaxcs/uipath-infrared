import type { RunEvent } from './run.js';

export interface PlanAction {
  component: string;
  action: string;
  to?: string;
}

export interface PlanSummary {
  layout?: string;
  steps?: number;
  monthlyEurNow?: number;
  monthlyEurAfter?: number;
  effortHours?: number;
  cutoverDowntimeHours?: number;
  availabilityPct?: number;
  actions?: PlanAction[];
}

export function planOf(event: RunEvent | undefined): PlanSummary | undefined {
  if (!event) return undefined;
  const raw = (event as RunEvent & { x_plan?: unknown }).x_plan;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const summary: PlanSummary = {};
  if (typeof source.layout === 'string') summary.layout = source.layout;
  if (typeof source.steps === 'number') summary.steps = source.steps;
  if (typeof source.monthly_eur_now === 'number') summary.monthlyEurNow = source.monthly_eur_now;
  if (typeof source.monthly_eur_after === 'number') summary.monthlyEurAfter = source.monthly_eur_after;
  if (typeof source.effort_hours === 'number') summary.effortHours = source.effort_hours;
  if (typeof source.cutover_downtime_hours === 'number') summary.cutoverDowntimeHours = source.cutover_downtime_hours;
  if (typeof source.availability_pct === 'number') summary.availabilityPct = source.availability_pct;
  if (Array.isArray(source.actions)) summary.actions = source.actions.filter(isAction).map(toAction);
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function isAction(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).component === 'string' && typeof (raw as Record<string, unknown>).action === 'string';
}

function toAction(raw: Record<string, unknown>): PlanAction {
  const action: PlanAction = { component: raw.component as string, action: raw.action as string };
  if (typeof raw.to === 'string') action.to = raw.to;
  return action;
}
