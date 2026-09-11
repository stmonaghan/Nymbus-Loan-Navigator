'use client';

import React, { useState, useCallback, useEffect, useRef, useId } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PrefillData {
  firstName: string;
  lastName: string;
  dob: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
}

export interface OtpStepProps {
  phoneNumber: string;
  onVerified: (prefill: PrefillData | null) => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const LOCK_DURATION_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_RESENDS = 3;

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const SIX_DIGIT_RE = /^\d{6}$/;

function validateCode(value: string): string | undefined {
  if (!SIX_DIGIT_RE.test(value)) {
    return 'Enter the 6-digit code from your text message.';
  }
  return undefined;
}

// ─────────────────────────────────────────────
// Formatting helper
// ─────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function OtpStep({ phoneNumber, onVerified }: OtpStepProps) {
  const uid = useId();

  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verify error message shown below the input
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  const [lockExpired, setLockExpired] = useState(false);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resend state
  const [resendCooldown, setResendCooldown] = useState(0); // seconds left in cooldown
  const [resendCount, setResendCount] = useState(0);
  const [resendHidden, setResendHidden] = useState(false); // max resends hit
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Input IDs ──
  const codeId = `${uid}-code`;
  const codeErrorId = `${uid}-code-error`;
  const verifyErrorId = `${uid}-verify-error`;
  const lockStatusId = `${uid}-lock-status`;
  const resendStatusId = `${uid}-resend-status`;

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────
  // Lock countdown
  // ─────────────────────────────────────────────

  const startLockCountdown = useCallback((seconds: number) => {
    setIsLocked(true);
    setLockExpired(false);
    setLockSecondsLeft(seconds);

    if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);

    lockIntervalRef.current = setInterval(() => {
      setLockSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(lockIntervalRef.current!);
          lockIntervalRef.current = null;
          setIsLocked(false);
          setLockExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─────────────────────────────────────────────
  // Resend cooldown
  // ─────────────────────────────────────────────

  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);

    resendIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendIntervalRef.current!);
          resendIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─────────────────────────────────────────────
  // Verify handler
  // ─────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setVerifyError(null);
      setTouched(true);

      if (validateCode(code)) {
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch('/api/identity/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, code }),
        });

        if (res.status === 200) {
          const data = (await res.json()) as { verified: boolean; prefill: PrefillData | null };
          if (data.verified) {
            onVerified(data.prefill);
            return;
          }
        }

        if (res.status === 422) {
          const data = (await res.json()) as {
            error: string;
            locked: boolean;
            attemptsRemaining: number;
          };

          if (data.locked) {
            startLockCountdown(LOCK_DURATION_SECONDS);
            setVerifyError(null);
            return;
          }

          setVerifyError(
            `Incorrect code. ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining.`
          );
          return;
        }

        if (res.status === 423) {
          startLockCountdown(LOCK_DURATION_SECONDS);
          return;
        }

        if (res.status === 404) {
          setVerifyError('Your session timed out. Please start verification again.');
          return;
        }

        setVerifyError('Something went wrong. Please try again.');
      } catch {
        setVerifyError('Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [code, phoneNumber, onVerified, startLockCountdown]
  );

  // ─────────────────────────────────────────────
  // Resend handler
  // ─────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || isResending || resendHidden) return;

    setResendError(null);
    setIsResending(true);

    try {
      const res = await fetch('/api/identity/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (res.status === 200) {
        const nextCount = resendCount + 1;
        setResendCount(nextCount);
        startResendCooldown();
        // Clear previous verify error so the user can try again fresh
        setVerifyError(null);
        setCode('');
        setTouched(false);
        return;
      }

      if (res.status === 429) {
        setResendHidden(true);
        return;
      }

      if (res.status === 503) {
        setResendError('Could not resend. Please try again later.');
        return;
      }

      setResendError('Could not resend. Please try again later.');
    } catch {
      setResendError('Could not resend. Please try again later.');
    } finally {
      setIsResending(false);
    }
  }, [resendCooldown, isResending, resendHidden, phoneNumber, resendCount, startResendCooldown]);

  // ─────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────

  const codeError = touched ? validateCode(code) : undefined;
  const isFormDisabled = isLoading || isLocked;
  const resendDisabled = resendCooldown > 0 || isResending || isFormDisabled;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <section aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`}>Enter your verification code</h2>

      <p>
        We sent a 6-digit code to <strong>{phoneNumber}</strong>. Enter it below
        to verify your identity.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── OTP input ── */}
        <div>
          <label htmlFor={codeId}>One-time code</label>
          <input
            id={codeId}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            aria-label="One-time code"
            value={code}
            onChange={(e) => {
              // Only allow digit characters
              const filtered = e.target.value.replace(/\D/g, '');
              setCode(filtered);
              setVerifyError(null);
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={!!codeError}
            aria-describedby={codeError ? codeErrorId : undefined}
            disabled={isFormDisabled}
            required
          />
          {codeError && (
            <span id={codeErrorId} role="alert">
              {codeError}
            </span>
          )}
        </div>

        {/* ── Verify error ── */}
        {verifyError && (
          <p id={verifyErrorId} role="alert">
            {verifyError}
          </p>
        )}

        {/* ── Lock status ── */}
        {isLocked && (
          <p id={lockStatusId} aria-live="polite">
            Too many incorrect codes. Try again in{' '}
            <strong>{formatCountdown(lockSecondsLeft)}</strong>.
          </p>
        )}
        {lockExpired && !isLocked && (
          <p id={lockStatusId} aria-live="polite">
            You may try again now.
          </p>
        )}

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={isFormDisabled}
          aria-disabled={isFormDisabled}
        >
          {isLoading ? 'Verifying…' : 'Verify code'}
        </button>
      </form>

      {/* ── Resend section ── */}
      <div>
        {!resendHidden ? (
          <>
            {resendCooldown > 0 ? (
              <span id={resendStatusId} aria-live="polite">
                Resend in <strong>{resendCooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendDisabled}
                aria-disabled={resendDisabled}
              >
                {isResending ? 'Sending…' : "Didn't receive a code? Resend"}
              </button>
            )}
          </>
        ) : (
          <p aria-live="polite">Maximum resends reached.</p>
        )}

        {resendError && (
          <p role="alert">{resendError}</p>
        )}
      </div>
    </section>
  );
}

export default OtpStep;
