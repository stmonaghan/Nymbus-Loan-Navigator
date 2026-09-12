import { getRateForTerm } from './loan-rates';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type LoanOutcome = 'approved' | 'referred' | 'declined';

export type LoanPurpose = 'debt_consolidation' | 'home_improvement' | 'other';

export interface LoanApplication {
  annualIncome: number;      // in USD, positive
  requestedAmount: number;   // in USD, positive
  termMonths: number;        // loan term in months
  purpose: LoanPurpose;
}

export interface LoanDecision {
  outcome: LoanOutcome;
  /** The requested amount — echoed back for display convenience. */
  requestedAmount: number;
  /** Debt-to-income ratio as a decimal (e.g. 0.28 = 28%). */
  dtiRatio: number;
  /** Loan term in months. */
  termMonths: number;
  /** Annual interest rate as a decimal (e.g. 0.0999 = 9.99%). */
  interestRate: number;
  /** Estimated monthly payment in USD, rounded to cents. */
  monthlyPayment: number;
}

// ─────────────────────────────────────────────
// Monthly payment (amortization)
// ─────────────────────────────────────────────

/**
 * Standard fixed-rate amortization:
 *   M = P * r / (1 - (1 + r)^-n)
 * where r = monthly rate, n = number of payments.
 * If the rate is 0, falls back to principal / n.
 * Returns the payment rounded to the nearest cent.
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new RangeError('principal must be a positive finite number');
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    throw new RangeError('termMonths must be a positive finite number');
  }

  const monthlyRate = annualRate / 12;

  let payment: number;
  if (monthlyRate === 0) {
    payment = principal / termMonths;
  } else {
    payment =
      (principal * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -termMonths));
  }

  return Math.round(payment * 100) / 100;
}

// ─────────────────────────────────────────────
// Decision engine
// ─────────────────────────────────────────────

/**
 * Rules-based loan decision.
 *
 * - approved  : requestedAmount ≤ 30% of annualIncome
 * - referred  : requestedAmount > 30% and ≤ 50% of annualIncome
 * - declined  : requestedAmount > 50% of annualIncome
 *
 * The interest rate is looked up from the mock rate file by term, and the
 * monthly payment is computed via standard amortization. Throws if income,
 * amount, or term are not positive finite numbers, or if the term has no rate.
 */
export function decideLoanOutcome(
  annualIncome: number,
  requestedAmount: number,
  termMonths: number,
  purpose: LoanPurpose
): LoanDecision {
  if (!Number.isFinite(annualIncome) || annualIncome <= 0) {
    throw new RangeError('annualIncome must be a positive finite number');
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new RangeError('requestedAmount must be a positive finite number');
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    throw new RangeError('termMonths must be a positive finite number');
  }

  const dtiRatio = requestedAmount / annualIncome;

  let outcome: LoanOutcome;
  if (dtiRatio <= 0.3) {
    outcome = 'approved';
  } else if (dtiRatio <= 0.5) {
    outcome = 'referred';
  } else {
    outcome = 'declined';
  }

  const interestRate = getRateForTerm(termMonths);
  const monthlyPayment = calculateMonthlyPayment(requestedAmount, interestRate, termMonths);

  return { outcome, requestedAmount, dtiRatio, termMonths, interestRate, monthlyPayment };
}
