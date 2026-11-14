import type { PlanSummary } from './plan-summary.js';
import type { RehearsalSummary } from './rehearsal-summary.js';
import { countPhrase, eur, percent } from './format.js';

export function rehearsalSentence(rehearsal: RehearsalSummary): string {
  const result = rehearsal.passed === undefined
    ? 'The rehearsal ran'
    : rehearsal.passed ? 'The rehearsal held' : 'The rehearsal missed the forecast';
  const facts: string[] = [];
  if (rehearsal.measuredAvailabilityPct !== undefined) {
    facts.push(
      `${percent(rehearsal.measuredAvailabilityPct)} availability` +
      (rehearsal.targetAvailabilityPct !== undefined ? ` against your ${percent(rehearsal.targetAvailabilityPct)} target` : '')
    );
  }
  const latency = rehearsal.latency;
  if (latency !== undefined) {
    const points = [latency.baselineP95, latency.failureP95, latency.recoveryP95].filter(value => value !== undefined);
    if (points.length > 0) facts.push(`p95 latency ${points.join(' → ')} ms`);
  }
  if (facts.length === 0) return `${result}.`;
  return `${result}: ${facts.join(', and ')}.`;
}

export function planSentence(plan: PlanSummary): string {
  const parts: string[] = [];
  if (plan.monthlyEurNow !== undefined && plan.monthlyEurAfter !== undefined) {
    parts.push(`The estate moves from ${eur(plan.monthlyEurNow)} a month to ${eur(plan.monthlyEurAfter)} a month.`);
  } else if (plan.monthlyEurAfter !== undefined) {
    parts.push(`The estate runs at ${eur(plan.monthlyEurAfter)} a month.`);
  }
  const size: string[] = [];
  if (plan.steps !== undefined) size.push(countPhrase(plan.steps, 'step', 'steps'));
  if (plan.actions?.length) size.push(countPhrase(plan.actions.length, 'action', 'actions'));
  if (size.length > 0) parts.push(`The plan has ${size.join(' and ')}.`);
  const effort: string[] = [];
  if (plan.effortHours !== undefined) effort.push(`${plan.effortHours} hours of work`);
  if (plan.cutoverDowntimeHours !== undefined) effort.push(`up to ${plan.cutoverDowntimeHours} hours of downtime`);
  if (effort.length > 0) parts.push(`It takes ${effort.join(' with ')}.`);
  if (plan.availabilityPct !== undefined) parts.push(`The result runs at ${percent(plan.availabilityPct)} availability.`);
  return parts.length > 0 ? parts.join(' ') : 'The plan follows the rehearsal.';
}
