'use client';

import React, { useState, useCallback, useId } from 'react';
import type { LoanPurpose } from '../../lib/loan-decision';
import { LOAN_TERMS_MONTHS } from '../../lib/loan-rates';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LoanFormInitialValues {
  requestedAmount: string;
  annualIncome: string;
  termMonths: string;
  purpose: LoanPurpose | '';
}

export interface LoanApplicationFormProps {
  applicantFirstName: string;
  initialValues?: LoanFormInitialValues;
  onSubmit: (
    annualIncome: number,
    requestedAmount: number,
    termMonths: number,
    purpose: LoanPurpose
  ) => void;
}

interface FormValues {
  requestedAmount: string;
  annualIncome: string;
  termMonths: string;
  purpose: LoanPurpose | '';
}

interface FormErrors {
  requestedAmount?: string;
  annualIncome?: string;
  termMonths?: string;
  purpose?: string;
}

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const MAX_LOAN_AMOUNT = 1_000_000;
const MAX_INCOME = 10_000_000;

function validateRequestedAmount(value: string): string | undefined {
  const n = Number(value);
  if (!value.trim() || isNaN(n)) return 'Requested loan amount is required.';
  if (n <= 0) return 'Enter a positive loan amount.';
  if (n > MAX_LOAN_AMOUNT) return `Loan amount cannot exceed $${MAX_LOAN_AMOUNT.toLocaleString()}.`;
  return undefined;
}

function validateAnnualIncome(value: string): string | undefined {
  const n = Number(value);
  if (!value.trim() || isNaN(n)) return 'Annual income is required.';
  if (n <= 0) return 'Enter a positive annual income.';
  if (n > MAX_INCOME) return `Annual income cannot exceed $${MAX_INCOME.toLocaleString()}.`;
  return undefined;
}

function validateTerm(value: string): string | undefined {
  if (!value) return 'Please select a loan term.';
  return undefined;
}

function validatePurpose(value: string): string | undefined {
  if (!value) return 'Please select a loan purpose.';
  return undefined;
}

function validateAll(values: FormValues): FormErrors {
  return {
    requestedAmount: validateRequestedAmount(values.requestedAmount),
    annualIncome: validateAnnualIncome(values.annualIncome),
    termMonths: validateTerm(values.termMonths),
    purpose: validatePurpose(values.purpose),
  };
}

function hasErrors(errors: FormErrors): boolean {
  return !!(errors.requestedAmount || errors.annualIncome || errors.termMonths || errors.purpose);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function LoanApplicationForm({ applicantFirstName, initialValues, onSubmit }: LoanApplicationFormProps) {
  const uid = useId();

  const [values, setValues] = useState<FormValues>(
    initialValues ?? {
      requestedAmount: '',
      annualIncome: '',
      termMonths: '',
      purpose: '',
    }
  );

  const [touched, setTouched] = useState<Record<keyof FormValues, boolean>>({
    requestedAmount: false,
    annualIncome: false,
    termMonths: false,
    purpose: false,
  });

  const errors = validateAll(values);

  const visibleErrors: FormErrors = {
    requestedAmount: touched.requestedAmount ? errors.requestedAmount : undefined,
    annualIncome: touched.annualIncome ? errors.annualIncome : undefined,
    termMonths: touched.termMonths ? errors.termMonths : undefined,
    purpose: touched.purpose ? errors.purpose : undefined,
  };

  const handleChange = useCallback(
    (field: keyof FormValues) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setValues((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleBlur = useCallback(
    (field: keyof FormValues) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setTouched({ requestedAmount: true, annualIncome: true, termMonths: true, purpose: true });

      const currentErrors = validateAll(values);
      if (hasErrors(currentErrors)) return;

      onSubmit(
        Number(values.annualIncome),
        Number(values.requestedAmount),
        Number(values.termMonths),
        values.purpose as LoanPurpose
      );
    },
    [values, onSubmit]
  );

  const amountId = `${uid}-amount`;
  const incomeId = `${uid}-income`;
  const termId = `${uid}-term`;
  const purposeId = `${uid}-purpose`;
  const amountErrorId = `${uid}-amount-error`;
  const incomeErrorId = `${uid}-income-error`;
  const termErrorId = `${uid}-term-error`;
  const purposeErrorId = `${uid}-purpose-error`;

  return (
    <section className="card animate-fade-in" aria-labelledby={`${uid}-heading`}>
      <h2 className="step-heading" id={`${uid}-heading`}>
        {applicantFirstName ? `Hi ${applicantFirstName} — ` : ''}Loan application
      </h2>

      <p className="step-subtext">Tell us about the loan you're looking for.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-1">
        {/* ── Requested loan amount ── */}
        <div className="field">
          <label className="field-label" htmlFor={amountId}>Requested loan amount ($)</label>
          <input
            id={amountId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_LOAN_AMOUNT}
            className={`input ${visibleErrors.requestedAmount ? 'input-error' : ''}`}
            value={values.requestedAmount}
            onChange={handleChange('requestedAmount')}
            onBlur={handleBlur('requestedAmount')}
            aria-invalid={!!visibleErrors.requestedAmount}
            aria-describedby={visibleErrors.requestedAmount ? amountErrorId : undefined}
            placeholder="e.g. 15000"
            required
          />
          {visibleErrors.requestedAmount && (
            <span className="field-error" id={amountErrorId} role="alert">
              {visibleErrors.requestedAmount}
            </span>
          )}
        </div>

        {/* ── Annual income ── */}
        <div className="field">
          <label className="field-label" htmlFor={incomeId}>Annual income ($)</label>
          <input
            id={incomeId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INCOME}
            className={`input ${visibleErrors.annualIncome ? 'input-error' : ''}`}
            value={values.annualIncome}
            onChange={handleChange('annualIncome')}
            onBlur={handleBlur('annualIncome')}
            aria-invalid={!!visibleErrors.annualIncome}
            aria-describedby={visibleErrors.annualIncome ? incomeErrorId : undefined}
            placeholder="e.g. 75000"
            required
          />
          {visibleErrors.annualIncome && (
            <span className="field-error" id={incomeErrorId} role="alert">
              {visibleErrors.annualIncome}
            </span>
          )}
        </div>

        {/* ── Requested loan term ── */}
        <div className="field">
          <label className="field-label" htmlFor={termId}>Requested loan term</label>
          <select
            id={termId}
            className={`input ${visibleErrors.termMonths ? 'input-error' : ''}`}
            value={values.termMonths}
            onChange={handleChange('termMonths')}
            onBlur={handleBlur('termMonths')}
            aria-invalid={!!visibleErrors.termMonths}
            aria-describedby={visibleErrors.termMonths ? termErrorId : undefined}
            required
          >
            <option value="">Select a term…</option>
            {LOAN_TERMS_MONTHS.map((term) => (
              <option key={term} value={term}>
                {term} months
              </option>
            ))}
          </select>
          {visibleErrors.termMonths && (
            <span className="field-error" id={termErrorId} role="alert">
              {visibleErrors.termMonths}
            </span>
          )}
        </div>

        {/* ── Loan purpose ── */}
        <div className="field">
          <label className="field-label" htmlFor={purposeId}>Loan purpose</label>
          <select
            id={purposeId}
            className={`input ${visibleErrors.purpose ? 'input-error' : ''}`}
            value={values.purpose}
            onChange={handleChange('purpose')}
            onBlur={handleBlur('purpose')}
            aria-invalid={!!visibleErrors.purpose}
            aria-describedby={visibleErrors.purpose ? purposeErrorId : undefined}
            required
          >
            <option value="">Select a purpose…</option>
            <option value="debt_consolidation">Debt Consolidation</option>
            <option value="home_improvement">Home Improvement</option>
            <option value="other">Other</option>
          </select>
          {visibleErrors.purpose && (
            <span className="field-error" id={purposeErrorId} role="alert">
              {visibleErrors.purpose}
            </span>
          )}
        </div>

        <button type="submit" className="btn btn-primary">Submit application</button>
      </form>
    </section>
  );
}

export default LoanApplicationForm;
