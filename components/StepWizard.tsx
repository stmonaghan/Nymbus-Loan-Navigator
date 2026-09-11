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
    case 'otp':
    case 'fallback':
      return 'Step 1 of 2';
    case 'confirm':
      return 'Step 2 of 2';
    case 'done':
      return null;
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function StepWizard({ onComplete }: StepWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [confirmedInfo, setConfirmedInfo] = useState<ConfirmedInfo | null>(null);

  // ── IdentityStep callbacks ──

  const handleMatchSuccess = useCallback((phone: string) => {
    setPhoneNumber(phone);
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
    <div>
      {progressLabel && (
        <p aria-label="Application progress" role="status">
          {progressLabel}
        </p>
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
        <p>Identity verified. Proceeding…</p>
      )}
    </div>
  );
}

export default StepWizard;
