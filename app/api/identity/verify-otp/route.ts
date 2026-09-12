import { NextRequest, NextResponse } from 'next/server';

import { checkOtp } from '../../../../lib/twilio';
import {
  getSession,
  incrementOtpAttempts,
  clearSession,
} from '../../../../lib/session-cache';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Maximum OTP attempts before the session is locked (mirrors session-cache). */
const MAX_OTP_ATTEMPTS = 5;

/**
 * Phone numbers that bypass real Twilio verification in test/demo environments.
 * Code "000000" is always accepted for these numbers.
 */
const TEST_PHONE_NUMBERS = new Set([
  '+15555550123',
  '+15555550456',
  '+15555550789',
  '+13026900497',
  '+14132976798',
]);

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

/** US E.164: +1 followed by exactly 10 digits. */
const E164_US_RE = /^\+1\d{10}$/;

/** Exactly 6 decimal digits. */
const SIX_DIGIT_RE = /^\d{6}$/;

function validateInput(body: unknown):
  | { valid: true; phoneNumber: string; code: string }
  | { valid: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be a JSON object.' };
  }

  const { phoneNumber, code } = body as Record<string, unknown>;

  if (typeof phoneNumber !== 'string' || !E164_US_RE.test(phoneNumber)) {
    return {
      valid: false,
      message:
        'phoneNumber must be a valid US E.164 number (e.g. +15555550123).',
    };
  }

  if (typeof code !== 'string' || !SIX_DIGIT_RE.test(code)) {
    return {
      valid: false,
      message: 'code must be exactly 6 digits.',
    };
  }

  return { valid: true, phoneNumber, code };
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_input', message: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  // 2. Validate input
  const parsed = validateInput(body);
  if (!parsed.valid) {
    return NextResponse.json(
      { error: 'invalid_input', message: parsed.message },
      { status: 400 }
    );
  }

  const { phoneNumber, code } = parsed;

  // 3. Session check
  const session = getSession(phoneNumber);
  if (!session) {
    return NextResponse.json(
      { error: 'session_not_found' },
      { status: 404 }
    );
  }

  // 4. Lock check — session already locked from prior failures
  if (session.locked) {
    return NextResponse.json(
      { error: 'locked', message: 'Too many attempts.' },
      { status: 423 }
    );
  }

  // 5. Determine whether the code is approved
  const isTestBypass =
    TEST_PHONE_NUMBERS.has(phoneNumber) && code === '000000';

  const approved: boolean = isTestBypass || (await checkOtp(phoneNumber, code));

  // 6. Failure path — increment counter, possibly lock session
  if (!approved) {
    const { attempts, locked } = incrementOtpAttempts(phoneNumber);
    const attemptsRemaining = locked ? 0 : MAX_OTP_ATTEMPTS - attempts;

    return NextResponse.json(
      {
        error: 'otp_invalid',
        locked,
        attemptsRemaining,
      },
      { status: 422 }
    );
  }

  // 7. Success path — clear session and return prefill data
  const record = session.record;
  clearSession(phoneNumber);

  if (record) {
    return NextResponse.json(
      {
        verified: true,
        prefill: {
          firstName: record.firstName,
          lastName: record.lastName,
          dob: record.dob,
          addressLine1: record.addressLine1,
          city: record.city,
          state: record.state,
          postalCode: record.postalCode,
          email: record.email,
        },
      },
      { status: 200 }
    );
  }

  // Manual-fallback path: session exists but no matched record
  return NextResponse.json(
    { verified: true, prefill: null },
    { status: 200 }
  );
}

// Return 405 for all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
