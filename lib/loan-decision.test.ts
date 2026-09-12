import { describe, it, expect } from 'vitest';
import { decideLoanOutcome, calculateMonthlyPayment } from './loan-decision';

describe('decideLoanOutcome', () => {
  // ── Approved (≤ 30%) ──────────────────────────────────────────────────────

  it('approves when requested amount is exactly 30% of income', () => {
    const result = decideLoanOutcome(100_000, 30_000, 36, 'debt_consolidation');
    expect(result.outcome).toBe('approved');
    expect(result.dtiRatio).toBeCloseTo(0.3);
  });

  it('approves when requested amount is well below 30% of income', () => {
    const result = decideLoanOutcome(100_000, 10_000, 24, 'home_improvement');
    expect(result.outcome).toBe('approved');
  });

  // ── Referred (> 30% and ≤ 50%) ───────────────────────────────────────────

  it('refers when requested amount is just above 30% of income', () => {
    const result = decideLoanOutcome(100_000, 30_001, 36, 'other');
    expect(result.outcome).toBe('referred');
  });

  it('refers when requested amount is exactly 50% of income', () => {
    const result = decideLoanOutcome(100_000, 50_000, 60, 'debt_consolidation');
    expect(result.outcome).toBe('referred');
    expect(result.dtiRatio).toBeCloseTo(0.5);
  });

  // ── Declined (> 50%) ─────────────────────────────────────────────────────

  it('declines when requested amount is just above 50% of income', () => {
    const result = decideLoanOutcome(100_000, 50_001, 48, 'home_improvement');
    expect(result.outcome).toBe('declined');
  });

  it('declines when requested amount exceeds income entirely', () => {
    const result = decideLoanOutcome(50_000, 60_000, 72, 'other');
    expect(result.outcome).toBe('declined');
  });

  // ── Returned values ───────────────────────────────────────────────────────

  it('echoes back requestedAmount in the result', () => {
    const result = decideLoanOutcome(100_000, 25_000, 36, 'other');
    expect(result.requestedAmount).toBe(25_000);
  });

  it('computes dtiRatio correctly', () => {
    const result = decideLoanOutcome(200_000, 40_000, 36, 'other');
    expect(result.dtiRatio).toBeCloseTo(0.2);
  });

  it('includes term, interest rate, and monthly payment in the result', () => {
    const result = decideLoanOutcome(100_000, 20_000, 36, 'other');
    expect(result.termMonths).toBe(36);
    expect(result.interestRate).toBeCloseTo(0.1099);
    expect(result.monthlyPayment).toBeGreaterThan(0);
  });

  // ── Guard clauses ─────────────────────────────────────────────────────────

  it('throws RangeError for zero income', () => {
    expect(() => decideLoanOutcome(0, 10_000, 36, 'other')).toThrow(RangeError);
  });

  it('throws RangeError for negative income', () => {
    expect(() => decideLoanOutcome(-50_000, 10_000, 36, 'other')).toThrow(RangeError);
  });

  it('throws RangeError for zero requested amount', () => {
    expect(() => decideLoanOutcome(100_000, 0, 36, 'other')).toThrow(RangeError);
  });

  it('throws RangeError for zero term', () => {
    expect(() => decideLoanOutcome(100_000, 10_000, 0, 'other')).toThrow(RangeError);
  });
});

describe('calculateMonthlyPayment', () => {
  it('computes a known amortization example correctly', () => {
    // $10,000 at 9.99% APR over 24 months ≈ $461.36/mo
    const payment = calculateMonthlyPayment(10_000, 0.0999, 24);
    expect(payment).toBeCloseTo(461.36, 1);
  });

  it('falls back to principal / n when rate is zero', () => {
    const payment = calculateMonthlyPayment(12_000, 0, 12);
    expect(payment).toBeCloseTo(1_000);
  });

  it('rounds to the nearest cent', () => {
    const payment = calculateMonthlyPayment(15_000, 0.1099, 36);
    expect(Number.isFinite(payment)).toBe(true);
    // no more than 2 decimal places
    expect(Math.round(payment * 100) / 100).toBe(payment);
  });

  it('throws RangeError for non-positive principal', () => {
    expect(() => calculateMonthlyPayment(0, 0.1, 12)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive term', () => {
    expect(() => calculateMonthlyPayment(10_000, 0.1, 0)).toThrow(RangeError);
  });
});
