import { describe, it, expect } from 'vitest';
import { percent } from '../src/domain/format.js';

describe('percent', () => {
  it('always shows two decimals', () => {
    expect(percent(99.9)).toBe('99.90%');
    expect(percent(99.99)).toBe('99.99%');
    expect(percent(99)).toBe('99.00%');
    expect(percent(99.95)).toBe('99.95%');
  });

  it('never rounds an availability up past what was measured', () => {
    expect(percent(99.996)).toBe('99.99%');
    expect(percent(99.899)).toBe('99.89%');
  });

  it('keeps exact hundredths that floating point stores just below the value', () => {
    expect(percent(0.29)).toBe('0.29%');
    expect(percent(99.92)).toBe('99.92%');
  });
});
