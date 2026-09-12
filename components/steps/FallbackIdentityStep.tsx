'use client';

import React, { useState, useCallback, useId } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ConfirmedInfo {
  firstName: string;
  lastName: string;
  dob: string;          // ISO date string, e.g. "1990-04-12"
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
  source: 'prefill' | 'manual';  // how the data was obtained
}

export interface FallbackIdentityStepProps {
  onComplete: (info: ConfirmedInfo) => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  dob: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  dob?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  email?: string;
}

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const POSTAL_CODE_RE = /^\d{5}(-\d{4})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_RE = /^[A-Z]{2}$/;

function validateRequired(value: string, fieldLabel: string): string | undefined {
  if (value.trim().length === 0) {
    return `${fieldLabel} is required.`;
  }
  return undefined;
}

function validateDob(value: string): string | undefined {
  if (value.trim().length === 0) {
    return 'Date of birth is required.';
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return 'Enter a valid date of birth.';
  }
  if (parsed >= new Date()) {
    return 'Date of birth must be in the past.';
  }
  return undefined;
}

function validateState(value: string): string | undefined {
  if (!STATE_RE.test(value)) {
    return 'Enter a valid 2-letter US state code (e.g. TX).';
  }
  return undefined;
}

function validatePostalCode(value: string): string | undefined {
  if (!POSTAL_CODE_RE.test(value)) {
    return 'Enter a valid ZIP code (e.g. 78701 or 78701-1234).';
  }
  return undefined;
}

function validateEmail(value: string): string | undefined {
  if (!EMAIL_RE.test(value)) {
    return 'Enter a valid email address.';
  }
  return undefined;
}

function validateAll(values: FormValues): FormErrors {
  return {
    firstName: validateRequired(values.firstName, 'First name'),
    lastName: validateRequired(values.lastName, 'Last name'),
    dob: validateDob(values.dob),
    addressLine1: validateRequired(values.addressLine1, 'Address'),
    city: validateRequired(values.city, 'City'),
    state: validateState(values.state),
    postalCode: validatePostalCode(values.postalCode),
    email: validateEmail(values.email),
  };
}

function hasErrors(errors: FormErrors): boolean {
  return !!(
    errors.firstName ||
    errors.lastName ||
    errors.dob ||
    errors.addressLine1 ||
    errors.city ||
    errors.state ||
    errors.postalCode ||
    errors.email
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function FallbackIdentityStep({ onComplete }: FallbackIdentityStepProps) {
  const uid = useId();

  const [values, setValues] = useState<FormValues>({
    firstName: '',
    lastName: '',
    dob: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    email: '',
  });

  // Only show inline errors after blur or submit attempt
  const [touched, setTouched] = useState<Record<keyof FormValues, boolean>>({
    firstName: false,
    lastName: false,
    dob: false,
    addressLine1: false,
    city: false,
    state: false,
    postalCode: false,
    email: false,
  });

  const errors = validateAll(values);

  // Compute visible errors: only show after field has been touched
  const visibleErrors: FormErrors = {
    firstName: touched.firstName ? errors.firstName : undefined,
    lastName: touched.lastName ? errors.lastName : undefined,
    dob: touched.dob ? errors.dob : undefined,
    addressLine1: touched.addressLine1 ? errors.addressLine1 : undefined,
    city: touched.city ? errors.city : undefined,
    state: touched.state ? errors.state : undefined,
    postalCode: touched.postalCode ? errors.postalCode : undefined,
    email: touched.email ? errors.email : undefined,
  };

  const handleChange = useCallback(
    (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Auto-uppercase the state field
      const value = field === 'state' ? raw.toUpperCase() : raw;
      setValues((prev) => ({ ...prev, [field]: value }));
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

      // Mark all fields as touched so errors show
      setTouched({
        firstName: true,
        lastName: true,
        dob: true,
        addressLine1: true,
        city: true,
        state: true,
        postalCode: true,
        email: true,
      });

      const currentErrors = validateAll(values);
      if (hasErrors(currentErrors)) {
        return;
      }

      onComplete({ ...values, source: 'manual' });
    },
    [values, onComplete]
  );

  // Input IDs tied to the component instance so multiple mounts don't clash
  const firstNameId = `${uid}-firstName`;
  const lastNameId = `${uid}-lastName`;
  const dobId = `${uid}-dob`;
  const addressLine1Id = `${uid}-addressLine1`;
  const cityId = `${uid}-city`;
  const stateId = `${uid}-state`;
  const postalCodeId = `${uid}-postalCode`;
  const emailId = `${uid}-email`;

  const firstNameErrorId = `${uid}-firstName-error`;
  const lastNameErrorId = `${uid}-lastName-error`;
  const dobErrorId = `${uid}-dob-error`;
  const addressLine1ErrorId = `${uid}-addressLine1-error`;
  const cityErrorId = `${uid}-city-error`;
  const stateErrorId = `${uid}-state-error`;
  const postalCodeErrorId = `${uid}-postalCode-error`;
  const emailErrorId = `${uid}-email-error`;

  return (
    <section className="animate-fade-in" aria-labelledby={`${uid}-heading`}>
      <h2 className="step-heading" id={`${uid}-heading`}>Enter your information</h2>

      <p className="step-subtext">
        We weren't able to verify your identity automatically — no worries.
        Enter your details below and we'll continue with phone verification.
      </p>

      <form className="mt-6 space-y-1" onSubmit={handleSubmit} noValidate>
        {/* ── First name ── */}
        <div className="field">
          <label className="field-label" htmlFor={firstNameId}>
            First name
          </label>
          <input
            id={firstNameId}
            className={`input ${visibleErrors.firstName ? 'input-error' : ''}`}
            type="text"
            autoComplete="given-name"
            value={values.firstName}
            onChange={handleChange('firstName')}
            onBlur={handleBlur('firstName')}
            aria-invalid={!!visibleErrors.firstName}
            aria-describedby={visibleErrors.firstName ? firstNameErrorId : undefined}
            required
          />
          {visibleErrors.firstName && (
            <span className="field-error" id={firstNameErrorId} role="alert">
              {visibleErrors.firstName}
            </span>
          )}
        </div>

        {/* ── Last name ── */}
        <div className="field">
          <label className="field-label" htmlFor={lastNameId}>
            Last name
          </label>
          <input
            id={lastNameId}
            className={`input ${visibleErrors.lastName ? 'input-error' : ''}`}
            type="text"
            autoComplete="family-name"
            value={values.lastName}
            onChange={handleChange('lastName')}
            onBlur={handleBlur('lastName')}
            aria-invalid={!!visibleErrors.lastName}
            aria-describedby={visibleErrors.lastName ? lastNameErrorId : undefined}
            required
          />
          {visibleErrors.lastName && (
            <span className="field-error" id={lastNameErrorId} role="alert">
              {visibleErrors.lastName}
            </span>
          )}
        </div>

        {/* ── Date of birth ── */}
        <div className="field">
          <label className="field-label" htmlFor={dobId}>
            Date of birth
          </label>
          <input
            id={dobId}
            className={`input ${visibleErrors.dob ? 'input-error' : ''}`}
            type="date"
            autoComplete="bday"
            value={values.dob}
            onChange={handleChange('dob')}
            onBlur={handleBlur('dob')}
            aria-invalid={!!visibleErrors.dob}
            aria-describedby={visibleErrors.dob ? dobErrorId : undefined}
            required
          />
          {visibleErrors.dob && (
            <span className="field-error" id={dobErrorId} role="alert">
              {visibleErrors.dob}
            </span>
          )}
        </div>

        {/* ── Address line 1 ── */}
        <div className="field">
          <label className="field-label" htmlFor={addressLine1Id}>
            Address
          </label>
          <input
            id={addressLine1Id}
            className={`input ${visibleErrors.addressLine1 ? 'input-error' : ''}`}
            type="text"
            autoComplete="address-line1"
            value={values.addressLine1}
            onChange={handleChange('addressLine1')}
            onBlur={handleBlur('addressLine1')}
            aria-invalid={!!visibleErrors.addressLine1}
            aria-describedby={visibleErrors.addressLine1 ? addressLine1ErrorId : undefined}
            required
          />
          {visibleErrors.addressLine1 && (
            <span className="field-error" id={addressLine1ErrorId} role="alert">
              {visibleErrors.addressLine1}
            </span>
          )}
        </div>

        {/* ── City ── */}
        <div className="field">
          <label className="field-label" htmlFor={cityId}>
            City
          </label>
          <input
            id={cityId}
            className={`input ${visibleErrors.city ? 'input-error' : ''}`}
            type="text"
            autoComplete="address-level2"
            value={values.city}
            onChange={handleChange('city')}
            onBlur={handleBlur('city')}
            aria-invalid={!!visibleErrors.city}
            aria-describedby={visibleErrors.city ? cityErrorId : undefined}
            required
          />
          {visibleErrors.city && (
            <span className="field-error" id={cityErrorId} role="alert">
              {visibleErrors.city}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* ── State ── */}
          <div className="field">
            <label className="field-label" htmlFor={stateId}>
              State
            </label>
            <input
              id={stateId}
              className={`input ${visibleErrors.state ? 'input-error' : ''}`}
              type="text"
              autoComplete="address-level1"
              maxLength={2}
              placeholder="TX"
              value={values.state}
              onChange={handleChange('state')}
              onBlur={handleBlur('state')}
              aria-invalid={!!visibleErrors.state}
              aria-describedby={visibleErrors.state ? stateErrorId : undefined}
              required
            />
            {visibleErrors.state && (
              <span className="field-error" id={stateErrorId} role="alert">
                {visibleErrors.state}
              </span>
            )}
          </div>

          {/* ── Postal code ── */}
          <div className="field">
            <label className="field-label" htmlFor={postalCodeId}>
              ZIP code
            </label>
            <input
              id={postalCodeId}
              className={`input ${visibleErrors.postalCode ? 'input-error' : ''}`}
              type="text"
              autoComplete="postal-code"
              value={values.postalCode}
              onChange={handleChange('postalCode')}
              onBlur={handleBlur('postalCode')}
              aria-invalid={!!visibleErrors.postalCode}
              aria-describedby={visibleErrors.postalCode ? postalCodeErrorId : undefined}
              placeholder="78701"
              required
            />
            {visibleErrors.postalCode && (
              <span className="field-error" id={postalCodeErrorId} role="alert">
                {visibleErrors.postalCode}
              </span>
            )}
          </div>
        </div>

        {/* ── Email ── */}
        <div className="field">
          <label className="field-label" htmlFor={emailId}>
            Email address
          </label>
          <input
            id={emailId}
            className={`input ${visibleErrors.email ? 'input-error' : ''}`}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange('email')}
            onBlur={handleBlur('email')}
            aria-invalid={!!visibleErrors.email}
            aria-describedby={visibleErrors.email ? emailErrorId : undefined}
            required
          />
          {visibleErrors.email && (
            <span className="field-error" id={emailErrorId} role="alert">
              {visibleErrors.email}
            </span>
          )}
        </div>

        {/* ── Submit button ── */}
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </form>
    </section>
  );
}

export default FallbackIdentityStep;
