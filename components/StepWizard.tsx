'use client';

import React, { useState, useCallback } from 'react';
import { IdentityStep } from './steps/IdentityStep';
import { OtpStep, type PrefillData } from './steps/OtpStep';
import { FallbackIdentityStep, type ConfirmedInfo } from './steps/FallbackIdentityStep';
import { ConfirmInfoStep } from './steps/ConfirmInfoStep';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type WizardStep = 'identity' | 'otp' | 'fallback' | 'confirm' | 'done';

export interface StepWizardProps {
  onComplete: (info: ConfirmedInfo) => void;
}

// ─────────────────────────────────────────────
// Progress indicator helpers
// ─────────────────────────────────────────────

function getProgressLabel(step: WizardStep): string | null {
  switch (step) {
    case 'identity':
    case 'fallback':
      return 'Step 1 of 5';
    case 'otp':
      return 'Step 2 of 5';
    case 'confirm':
      return 'Step 3 of 5';
    case 'done':
      return null;
  }
}

// ─────────────────────────────────────────────
// Progress bar (presentational)
// ─────────────────────────────────────────────

function ProgressBar({ label }: { label: string }) {
  // Parse "Step N of M" to compute fill width; falls back gracefully.
  const match = label.match(/Step (\d+) of (\d+)/);
  const current = match ? Number(match[1]) : 0;
  const total = match ? Number(match[2]) : 1;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {label}
        </span>
        <span className="text-xs font-medium text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200" role="presentation">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function StepWizard({ onComplete }: StepWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [confirmedInfo, setConfirmedInfo] = useState<ConfirmedInfo | null>(null);

  // ── IdentityStep callbacks ──

  const handleMatchSuccess = useCallback((phone: string, token: string) => {
    setPhoneNumber(phone);
    setSessionToken(token);
    setCurrentStep('otp');
  }, []);

  const handleNoMatch = useCallback(() => {
    setCurrentStep('fallback');
  }, []);

  // ── OtpStep callback ──

  const handleOtpVerified = useCallback((prefill: PrefillData | null) => {
    let info: ConfirmedInfo;

    if (prefill !== null) {
      // Matched path — build ConfirmedInfo from the prefill data
      info = {
        firstName: prefill.firstName,
        lastName: prefill.lastName,
        dob: prefill.dob,
        addressLine1: prefill.addressLine1,
        city: prefill.city,
        state: prefill.state,
        postalCode: prefill.postalCode,
        email: prefill.email,
        source: 'prefill',
      };
    } else {
      // Manual-fallback path — OTP verified but no prefill data
      info = {
        firstName: '',
        lastName: '',
        dob: '',
        addressLine1: '',
        city: '',
        state: '',
        postalCode: '',
        email: '',
        source: 'manual',
      };
    }

    setConfirmedInfo(info);
    setCurrentStep('confirm');
  }, []);

  // ── FallbackIdentityStep callback ──

  const handleFallbackComplete = useCallback((info: ConfirmedInfo) => {
    setConfirmedInfo(info);
    setCurrentStep('confirm');
  }, []);

  // ── ConfirmInfoStep callback ──

  const handleConfirm = useCallback(
    (confirmed: ConfirmedInfo) => {
      setCurrentStep('done');
      onComplete(confirmed);
    },
    [onComplete]
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const progressLabel = getProgressLabel(currentStep);

  return (
    <div className="card animate-fade-in">
      {progressLabel && (
        <>
          <p className="sr-only" aria-label="Application progress" role="status">
            {progressLabel}
          </p>
          <ProgressBar label={progressLabel} />
        </>
      )}

      {currentStep === 'identity' && (
        <IdentityStep
          onMatchSuccess={handleMatchSuccess}
          onNoMatch={handleNoMatch}
        />
      )}

      {currentStep === 'otp' && (
        <OtpStep
          phoneNumber={phoneNumber}
          sessionToken={sessionToken}
          onVerified={handleOtpVerified}
        />
      )}

      {currentStep === 'fallback' && (
        <FallbackIdentityStep onComplete={handleFallbackComplete} />
      )}

      {currentStep === 'confirm' && confirmedInfo !== null && (
        <ConfirmInfoStep
          info={confirmedInfo}
          onConfirm={handleConfirm}
        />
      )}

      {currentStep === 'done' && (
        <p className="py-4 text-center text-sm text-slate-500">Identity verified. Proceeding…</p>
      )}
    </div>
  );
}

export default StepWizard;
