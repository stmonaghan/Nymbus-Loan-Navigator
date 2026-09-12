import { NextRequest, NextResponse } from 'next/server';

import { checkRateLimit } from '../../../../lib/rate-limit';
import { matchIdentity } from '../../../../lib/mno-mock';
import { sendOtp } from '../../../../lib/twilio';
import { createSession } from '../../../../lib/session-cache';

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

/** US E.164: +1 followed by exactly 10 digits. */
const E164_US_RE = /^\+1\d{10}$/;

/** Single ASCII letter (case-insensitive). */
const INITIAL_RE = /^[A-Za-z]$/;

function validateInput(body: unknown): {
  valid: true;
  phoneNumber: string;
  lastName: string;
  firstNameInitial: string;
} | {
  valid: false;
  message: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be a JSON object.' };
  }

  const { phoneNumber, lastName, firstNameInitial } = body as Record<string, unknown>;

  if (typeof phoneNumber !== 'string' || !E164_US_RE.test(phoneNumber)) {
    return {
      valid: false,
      message:
        'phoneNumber must be a valid US E.164 number (e.g. +15555550123).',
    };
  }

  if (typeof lastName !== 'string' || lastName.trim().length === 0) {
    return { valid: false, message: 'lastName must be a non-empty string.' };
  }

  if (typeof firstNameInitial !== 'string' || !INITIAL_RE.test(firstNameInitial)) {
    return {
      valid: false,
      message: 'firstNameInitial must be a single letter (A–Z).',
    };
  }

  return {
    valid: true,
    phoneNumber,
    lastName: lastName.trim(),
    firstNameInitial,
  };
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

  const { phoneNumber, lastName, firstNameInitial } = parsed;

  // 3. Rate-limit check
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  const rateLimit = checkRateLimit(phoneNumber, ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', resetAt: rateLimit.resetAt },
      { status: 429 }
    );
  }

  // 4. Identity match
  // When USE_LIVE_IDENTITY_MATCH=true, this is the hook point for a real
  // vendor call. For now (and per the spec stub note) both branches use the
  // mock — the env var flag is preserved so the swap is a one-liner later.
  const { summaryScore, record } =
    process.env.USE_LIVE_IDENTITY_MATCH === 'true'
      ? matchIdentity(phoneNumber, lastName, firstNameInitial) // stub — replace with live call
      : matchIdentity(phoneNumber, lastName, firstNameInitial);

  // 5. No match → return early, no OTP sent
  if (summaryScore === 'no_match') {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  // 6. Matched (high or medium) → send OTP
  const otpResult = await sendOtp(phoneNumber);
  if (otpResult === null) {
    return NextResponse.json(
      { error: 'otp_send_failed' },
      { status: 503 }
    );
  }

  // 7. Create a signed session token holding the matched record + counters.
  //    Stateless: the client stores this and returns it on verify/resend, so
  //    it survives across separate serverless invocations on Vercel.
  const sessionToken = createSession(phoneNumber, record);

  // 8. Return success + session token — never include record/PII at this stage
  return NextResponse.json(
    { matched: true, summaryScore, sessionToken },
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
