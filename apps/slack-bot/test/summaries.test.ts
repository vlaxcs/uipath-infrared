import { describe, it, expect } from 'vitest';
import { rehearsalOf } from '../src/domain/rehearsal-summary.js';
import { planOf } from '../src/domain/plan-summary.js';
import { afterLayoutEvent, sampleEvent } from './sample.js';

describe('Gate summaries', () => {
  it('reads the rehearsal result off the plan gate', () => {
    expect(rehearsalOf(afterLayoutEvent(20))).toEqual({
      measuredAvailabilityPct: 99.92,
      targetAvailabilityPct: 99.9,
      passed: true,
      gapPct: 0.02,
      failure: 'stopped the primary database; the fallback took over',
      latency: { baselineP95: 42, failureP95: 51, recoveryP95: 44 },
    });
  });

  it('reads the plan off the plan gate', () => {
    expect(planOf(afterLayoutEvent(20))).toEqual({
      layout: 'managed_services',
      steps: 3,
      monthlyEurNow: 133308,
      monthlyEurAfter: 82665,
      effortHours: 514,
      cutoverDowntimeHours: 2,
      availabilityPct: 99.95,
      actions: [
        { component: 'rds-orders', action: 'resize', to: 'db.r5.4xlarge' },
        { component: 's3-legacy-reports', action: 'move', to: 'aws-s3 eu-west-1' },
        { component: 'ng-shop-staging', action: 'resize', to: '3 x m5.2xlarge' },
      ],
    });
  });

  it('returns nothing when the event carries no summary', () => {
    expect(rehearsalOf(sampleEvent(14))).toBeUndefined();
    expect(planOf(sampleEvent(14))).toBeUndefined();
    expect(rehearsalOf(undefined)).toBeUndefined();
    expect(planOf(undefined)).toBeUndefined();
  });

  it('keeps only well-typed fields', () => {
    const event = { ...sampleEvent(14), x_rehearsal: { measured_availability_pct: 'high', passed: false }, x_plan: { steps: 3, actions: [{ component: 'a' }] } } as any;
    expect(rehearsalOf(event)).toEqual({ passed: false });
    expect(planOf(event)).toEqual({ steps: 3, actions: [] });
  });
});
