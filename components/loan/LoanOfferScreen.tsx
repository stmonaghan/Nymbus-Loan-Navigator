'use client';

import React, { useId } from 'react';
import type { LoanDecision } from '../../lib/loan-decision';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LoanOfferScreenProps {
  applicantFirstName: string;
  decision: LoanDecision;
  onUpdate: () => void;
  onSelect: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatCurrencyCents(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

// ─────────────────────────────────────────────
// Loan detail breakdown (approved + referred)
// ─────────────────────────────────────────────

function LoanBreakdown({ decision }: { decision: LoanDecision }) {
  const rows: Array<{ label: string; value: string; emphasize?: boolean }> = [
    { label: 'Loan amount', value: formatCurrency(decision.requestedAmount) },
    { label: 'Loan term', value: `${decision.termMonths} months` },
    { label: 'Interest rate (APR)', value: formatRate(decision.interestRate) },
    { label: 'Estimated monthly payment', value: formatCurrencyCents(decision.monthlyPayment), emphasize: true },
  ];

  return (
    <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 text-left">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-slate-500">{row.label}</dt>
          <dd className={row.emphasize ? 'text-base font-semibold text-slate-900' : 'text-sm font-medium text-slate-800'}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OfferActions({ onUpdate, onSelect }: { onUpdate: () => void; onSelect: () => void }) {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
      <button type="button" className="btn btn-primary" onClick={onSelect}>
        Select
      </button>
      <button type="button" className="btn btn-ghost" onClick={onUpdate}>
        Update
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function LoanOfferScreen({ applicantFirstName, decision, onUpdate, onSelect }: LoanOfferScreenProps) {
  const uid = useId();
  const firstName = applicantFirstName || 'there';

  return (
    <section className="card animate-fade-in text-center" aria-labelledby={`${uid}-heading`}>
      {decision.outcome === 'approved' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl" aria-hidden="true">✓</div>
          <h2 className="step-heading text-emerald-700" id={`${uid}-heading`}>Great news, {firstName}!</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your application for {formatCurrency(decision.requestedAmount)} has been{' '}
            <strong>approved</strong>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your debt-to-income ratio is {formatPercent(decision.dtiRatio)}, which meets our
            lending criteria.
          </p>
          <LoanBreakdown decision={decision} />
          <OfferActions onUpdate={onUpdate} onSelect={onSelect} />
        </>
      )}

      {decision.outcome === 'referred' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl" aria-hidden="true">⏳</div>
          <h2 className="step-heading text-amber-800" id={`${uid}-heading`}>Thanks, {firstName} — we're reviewing your application.</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your application for {formatCurrency(decision.requestedAmount)} has been sent for{' '}
            <strong>manual review</strong>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your debt-to-income ratio of {formatPercent(decision.dtiRatio)} requires a closer
            look by our underwriting team.
          </p>
          <LoanBreakdown decision={decision} />
          <OfferActions onUpdate={onUpdate} onSelect={onSelect} />
        </>
      )}

      {decision.outcome === 'declined' && (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl" aria-hidden="true">✕</div>
          <h2 className="step-heading text-red-700" id={`${uid}-heading`}>We're sorry, {firstName}.</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            We're unable to approve your application for{' '}
            {formatCurrency(decision.requestedAmount)} at this time.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your requested amount exceeds our debt-to-income threshold of 50% (your ratio:{' '}
            {formatPercent(decision.dtiRatio)}).
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            You're welcome to apply again with a lower loan amount or after your income
            situation changes.
          </p>
          <button type="button" className="btn btn-primary mt-6" onClick={onUpdate}>
            Update my application
          </button>
        </>
      )}
    </section>
  );
}

export default LoanOfferScreen;
