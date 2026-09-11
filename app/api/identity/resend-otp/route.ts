import { NextRequest, NextResponse } from 'next/server';

import { sendOtp } from '../../../../lib/twilio';
import {
  getSession,
  incrementResend,
} from '../../../../lib/session-cache';

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

/** US E.164: +1 followed by exactly 10 digits. */
const E164_US_RE = /^\+1\d{10}$/;

function validateInput(body: unknown):
  | { valid: true; phoneNumber: string }
  | { valid: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be a JSON object.' };
  }

  const { phoneNumber } = body as Record<string, unknown>;

  if (typeof phoneNumber !== 'string' || !E164_US_RE.test(phoneNumber)) {
    return {
      valid: false,
      message:
        'phoneNumber must be a valid US E.164 number (e.g. +15555550123).',
    };
  }

  return { valid: true, phoneNumber };
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

  const { phoneNumber } = parsed;

  // 3. Session check
  const session = getSession(phoneNumber);
  if (!session) {
    return NextResponse.json(
      { error: 'session_not_found' },
      { status: 404 }
    );
  }

  // 4. Resend limit check — increment first; bail if exceeded
  const { exceeded } = incrementResend(phoneNumber);
  if (exceeded) {
    return NextResponse.json(
      { error: 'resend_limit_exceeded' },
      { status: 429 }
    );
  }

  // 5. Send OTP
  const otpResult = await sendOtp(phoneNumber);
  if (otpResult === null) {
    return NextResponse.json(
      { error: 'otp_send_failed' },
      { status: 503 }
    );
  }

  // 6. Success
  return NextResponse.json({ resent: true }, { status: 200 });
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
