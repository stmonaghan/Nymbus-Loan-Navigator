import { describe, it, expect } from 'vitest';
import { getRateForTerm, LOAN_TERMS_MONTHS } from './loan-rates';

describe('getRateForTerm', () => {
  it('returns the configured rate for each offered term', () => {
    expect(getRateForTerm(12)).toBeCloseTo(0.0899);
    expect(getRateForTerm(24)).toBeCloseTo(0.0999);
    expect(getRateForTerm(36)).toBeCloseTo(0.1099);
    expect(getRateForTerm(48)).toBeCloseTo(0.1249);
    expect(getRateForTerm(60)).toBeCloseTo(0.1399);
    expect(getRateForTerm(72)).toBeCloseTo(0.1549);
  });

  it('has a rate configured for every term in LOAN_TERMS_MONTHS', () => {
    for (const term of LOAN_TERMS_MONTHS) {
      expect(() => getRateForTerm(term)).not.toThrow();
      expect(typeof getRateForTerm(term)).toBe('number');
    }
  });

  it('throws RangeError for an unconfigured term', () => {
    expect(() => getRateForTerm(18)).toThrow(RangeError);
  });
});
