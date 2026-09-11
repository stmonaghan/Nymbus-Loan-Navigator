'use client';

import React, { useState, useCallback, useId } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface IdentityStepProps {
  onMatchSuccess: (phoneNumber: string) => void;
  onNoMatch: () => void;
}

interface FormValues {
  phoneNumber: string;
  lastName: string;
  firstNameInitial: string;
}

interface FormErrors {
  phoneNumber?: string;
  lastName?: string;
  firstNameInitial?: string;
}

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const E164_US_RE = /^\+1\d{10}$/;
const INITIAL_RE = /^[A-Za-z]$/;

function validatePhone(value: string): string | undefined {
  if (!E164_US_RE.test(value)) {
    return 'Enter a valid US phone number in the format +15555550123.';
  }
  return undefined;
}

function validateLastName(value: string): string | undefined {
  if (value.trim().length === 0) {
    return 'Last name is required.';
  }
  return undefined;
}

function validateInitial(value: string): string | undefined {
  if (!INITIAL_RE.test(value)) {
    return 'Enter a single letter (A–Z).';
  }
  return undefined;
}

function validateAll(values: FormValues): FormErrors {
  return {
    phoneNumber: validatePhone(values.phoneNumber),
    lastName: validateLastName(values.lastName),
    firstNameInitial: validateInitial(values.firstNameInitial),
  };
}

function hasErrors(errors: FormErrors): boolean {
  return !!(errors.phoneNumber || errors.lastName || errors.firstNameInitial);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function IdentityStep({ onMatchSuccess, onNoMatch }: IdentityStepProps) {
  const uid = useId();

  const [values, setValues] = useState<FormValues>({
    phoneNumber: '',
    lastName: '',
    firstNameInitial: '',
  });

  // Only show inline errors after blur or submit attempt
  const [touched, setTouched] = useState<Record<keyof FormValues, boolean>>({
    phoneNumber: false,
    lastName: false,
    firstNameInitial: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validateAll(values);

  // Compute visible errors: only show after field has been touched
  const visibleErrors: FormErrors = {
    phoneNumber: touched.phoneNumber ? errors.phoneNumber : undefined,
    lastName: touched.lastName ? errors.lastName : undefined,
    firstNameInitial: touched.firstNameInitial ? errors.firstNameInitial : undefined,
  };

  const handleChange = useCallback(
    (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setValues((prev) => ({ ...prev, [field]: raw }));
      // Clear submit-level error when user starts typing again
      setSubmitError(null);
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
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);

      // Mark all fields as touched so errors show
      setTouched({ phoneNumber: true, lastName: true, firstNameInitial: true });

      const currentErrors = validateAll(values);
      if (hasErrors(currentErrors)) {
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch('/api/identity/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: values.phoneNumber,
            lastName: values.lastName.trim(),
            firstNameInitial: values.firstNameInitial,
          }),
        });

        if (res.status === 429) {
          setSubmitError('Too many attempts — please try again in 15 minutes.');
          return;
        }

        if (!res.ok) {
          setSubmitError('Something went wrong. Please try again.');
          return;
        }

        const data = (await res.json()) as { matched: boolean };

        if (data.matched) {
          onMatchSuccess(values.phoneNumber);
        } else {
          onNoMatch();
        }
      } catch {
        setSubmitError('Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [values, onMatchSuccess, onNoMatch]
  );

  // Input IDs tied to the component instance so multiple mounts don't clash
  const phoneId = `${uid}-phone`;
  const lastNameId = `${uid}-lastName`;
  const initialId = `${uid}-initial`;
  const phoneErrorId = `${uid}-phone-error`;
  const lastNameErrorId = `${uid}-lastName-error`;
  const initialErrorId = `${uid}-initial-error`;
  const submitErrorId = `${uid}-submit-error`;

  return (
    <section aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`}>Verify your identity</h2>

      <p>
        We use your phone number and name to confirm your identity — no credit
        pull at this stage.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Phone number ── */}
        <div>
          <label htmlFor={phoneId}>
            Mobile phone number
          </label>
          <input
            id={phoneId}
            type="tel"
            autoComplete="tel"
            value={values.phoneNumber}
            onChange={handleChange('phoneNumber')}
            onBlur={handleBlur('phoneNumber')}
            aria-invalid={!!visibleErrors.phoneNumber}
            aria-describedby={visibleErrors.phoneNumber ? phoneErrorId : undefined}
            placeholder="+15555550123"
            disabled={isLoading}
            required
          />
          {visibleErrors.phoneNumber && (
            <span id={phoneErrorId} role="alert">
              {visibleErrors.phoneNumber}
            </span>
          )}
        </div>

        {/* ── Last name ── */}
        <div>
          <label htmlFor={lastNameId}>
            Last name
          </label>
          <input
            id={lastNameId}
            type="text"
            autoComplete="family-name"
            value={values.lastName}
            onChange={handleChange('lastName')}
            onBlur={handleBlur('lastName')}
            aria-invalid={!!visibleErrors.lastName}
            aria-describedby={visibleErrors.lastName ? lastNameErrorId : undefined}
            disabled={isLoading}
            required
          />
          {visibleErrors.lastName && (
            <span id={lastNameErrorId} role="alert">
              {visibleErrors.lastName}
            </span>
          )}
        </div>

        {/* ── First name initial ── */}
        <div>
          <label htmlFor={initialId}>
            First name initial
          </label>
          <input
            id={initialId}
            type="text"
            autoComplete="given-name"
            maxLength={1}
            value={values.firstNameInitial}
            onChange={handleChange('firstNameInitial')}
            onBlur={handleBlur('firstNameInitial')}
            aria-invalid={!!visibleErrors.firstNameInitial}
            aria-describedby={visibleErrors.firstNameInitial ? initialErrorId : undefined}
            disabled={isLoading}
            required
          />
          {visibleErrors.firstNameInitial && (
            <span id={initialErrorId} role="alert">
              {visibleErrors.firstNameInitial}
            </span>
          )}
        </div>

        {/* ── Consent disclosure (visible, not collapsed) ── */}
        <p aria-live="polite">
          By continuing, you authorize Nymbus Loan Navigator to verify your
          identity using your mobile carrier data.
        </p>

        {/* ── Submit-level error ── */}
        {submitError && (
          <p id={submitErrorId} role="alert">
            {submitError}
          </p>
        )}

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={isLoading}
          aria-disabled={isLoading}
          aria-describedby={submitError ? submitErrorId : undefined}
        >
          {isLoading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </section>
  );
}

export default IdentityStep;
