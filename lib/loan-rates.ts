import rates from './mock-loan-rates.json';

/** Loan term options offered to applicants, in months. */
export const LOAN_TERMS_MONTHS = [12, 24, 36, 48, 60, 72] as const;

export type LoanTermMonths = (typeof LOAN_TERMS_MONTHS)[number];

/**
 * Returns the annual interest rate (as a decimal, e.g. 0.0999 = 9.99%)
 * for a given loan term in months, read from the mock rate file.
 * Throws RangeError if the term has no configured rate.
 */
export function getRateForTerm(termMonths: number): number {
  const rate = (rates as Record<string, number>)[String(termMonths)];
  if (rate === undefined) {
    throw new RangeError(`No configured interest rate for a ${termMonths}-month term`);
  }
  return rate;
}
