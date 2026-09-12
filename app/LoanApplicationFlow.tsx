'use client';

import React, { useState, useCallback } from 'react';
import { StepWizard } from '../components/StepWizard';
import { LoanApplicationForm, type LoanFormInitialValues } from '../components/loan/LoanApplicationForm';
import { LoanOfferScreen } from '../components/loan/LoanOfferScreen';
import { decideLoanOutcome } from '../lib/loan-decision';
import type { ConfirmedInfo } from '../components/steps/FallbackIdentityStep';
import type { LoanDecision, LoanPurpose } from '../lib/loan-decision';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type FlowPhase = 'identity' | 'loan' | 'result' | 'confirmed';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function LoanApplicationFlow() {
  const [phase, setPhase] = useState<FlowPhase>('identity');
  const [confirmedInfo, setConfirmedInfo] = useState<ConfirmedInfo | null>(null);
  const [loanDecision, setLoanDecision] = useState<LoanDecision | null>(null);
  const [loanFormValues, setLoanFormValues] = useState<LoanFormInitialValues | undefined>(undefined);

  // Called by StepWizard when identity verification + confirm step completes
  const handleIdentityComplete = useCallback((info: ConfirmedInfo) => {
    setConfirmedInfo(info);
    setPhase('loan');
  }, []);

  // Called by LoanApplicationForm on valid submit
  const handleLoanSubmit = useCallback(
    (annualIncome: number, requestedAmount: number, termMonths: number, purpose: LoanPurpose) => {
      // Preserve entered values so the applicant can return via "Update"
      setLoanFormValues({
        requestedAmount: String(requestedAmount),
        annualIncome: String(annualIncome),
        termMonths: String(termMonths),
        purpose,
      });
      const decision = decideLoanOutcome(annualIncome, requestedAmount, termMonths, purpose);
      setLoanDecision(decision);
      setPhase('result');
    },
    []
  );

  // "Update" on the offer screen — return to the loan form with prior values
  const handleUpdate = useCallback(() => {
    setPhase('loan');
  }, []);

  // "Select" on the offer screen — advance toward loan verification
  const handleSelect = useCallback(() => {
    setPhase('confirmed');
  }, []);

  return (
    <div className="flex w-full flex-col items-center">
      {phase === 'identity' && (
        <StepWizard onComplete={handleIdentityComplete} />
      )}

      {phase === 'loan' && (
        <>
          <div className="mb-5 w-full max-w-md">
            <p className="sr-only" aria-label="Application progress" role="status">Step 4 of 5</p>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Step 4 of 5</span>
              <span className="text-xs font-medium text-slate-400">80%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: '80%' }} />
            </div>
          </div>
          <LoanApplicationForm
            applicantFirstName={confirmedInfo?.firstName ?? ''}
            initialValues={loanFormValues}
            onSubmit={handleLoanSubmit}
          />
        </>
      )}

      {phase === 'result' && loanDecision !== null && (
        <>
          <div className="mb-5 w-full max-w-md">
            <p className="sr-only" aria-label="Application progress" role="status">Step 5 of 5</p>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Step 5 of 5</span>
              <span className="text-xs font-medium text-slate-400">100%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>
          <LoanOfferScreen
            applicantFirstName={confirmedInfo?.firstName ?? ''}
            decision={loanDecision}
            onUpdate={handleUpdate}
            onSelect={handleSelect}
          />
        </>
      )}

      {phase === 'confirmed' && (
        <section className="card animate-fade-in text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl" aria-hidden="true">🎉</div>
          <h2 className="step-heading text-brand-700">Offer selected!</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Thanks{confirmedInfo?.firstName ? `, ${confirmedInfo.firstName}` : ''} — we've locked in your selected terms.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Next, we'll guide you through loan verification to finalize everything. A specialist will pick up from here.
          </p>
        </section>
      )}
    </div>
  );
}
