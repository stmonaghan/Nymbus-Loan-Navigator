/**
 * Tests for POST /api/identity/resend-otp
 *
 * Strategy:
 * - vi.mock lib/twilio so no real Twilio calls are made.
 * - Use the real session-cache and its _clearAllSessions helper for isolation.
 * - Cover: input validation, session-not-found, resend limit exceeded,
 *   sendOtp failure (503), success (200 { resent: true }), and non-POST
 *   method rejection (405).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Twilio before importing the route ──────────────────────────────────
vi.mock('../../../../lib/twilio', () => ({
  sendOtp: vi.fn(),
}));

import { POST, GET, PUT, PATCH, DELETE } from './route';
import { createSession, _clearAllSessions } from '../../../../lib/session-cache';
import { sendOtp } from '../../../../lib/twilio';
import type { MNORecord } from '../../../../lib/mno-mock';

// ── Helpers ──────────────────────────────────────────────────────────────────

const JOHN_PHONE = '+15555550123';

const JOHN_RECORD: MNORecord = {
  firstName: 'John',
  lastName: 'Smith',
  dob: '1990-04-12',
  addressLine1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  email: 'john.smith@example.com',
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/identity/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearAllSessions();
  vi.mocked(sendOtp).mockReset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('POST /api/identity/resend-otp — input validation', () => {
  it('returns 400 for non-JSON body', async () => {
    const req = new NextRequest('http://localhost/api/identity/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for missing phoneNumber', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/phoneNumber/);
  });

  it('returns 400 for a non-US phone number', async () => {
    const res = await POST(makeRequest({ phoneNumber: '+447911123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for phone number without country code', async () => {
    const res = await POST(makeRequest({ phoneNumber: '5555550123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for phone number with wrong digit count', async () => {
    const res = await POST(makeRequest({ phoneNumber: '+1555555012' })); // 9 digits after +1
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 when body is a primitive (not an object)', async () => {
    const res = await POST(makeRequest('not-an-object'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });
});

// ── Session checks ────────────────────────────────────────────────────────────

describe('POST /api/identity/resend-otp — session checks', () => {
  it('returns 404 when no session exists for the phone', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('session_not_found');
  });

  it('does not call sendOtp when session is not found', async () => {
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(sendOtp).not.toHaveBeenCalled();
  });
});

// ── Resend limit ──────────────────────────────────────────────────────────────

describe('POST /api/identity/resend-otp — resend limit', () => {
  it('returns 429 after the resend limit is exceeded', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(sendOtp).mockResolvedValue({ sid: 'VS_test' });

    // The session-cache MAX_RESENDS is 3; exhaust them
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));

    // 4th attempt should exceed the limit
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('resend_limit_exceeded');
  });

  it('does not call sendOtp when the resend limit is exceeded', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(sendOtp).mockResolvedValue({ sid: 'VS_test' });

    // Exhaust the limit
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));

    vi.mocked(sendOtp).mockClear();

    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(sendOtp).not.toHaveBeenCalled();
  });
});

// ── sendOtp failures ──────────────────────────────────────────────────────────

describe('POST /api/identity/resend-otp — sendOtp failure', () => {
  it('returns 503 when sendOtp returns null', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(sendOtp).mockResolvedValue(null);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('otp_send_failed');
  });
});

// ── Success ───────────────────────────────────────────────────────────────────

describe('POST /api/identity/resend-otp — success', () => {
  it('returns 200 { resent: true } when OTP is sent successfully', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(sendOtp).mockResolvedValue({ sid: 'VS_test_sid' });

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resent).toBe(true);
  });

  it('calls sendOtp with the correct phone number', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(sendOtp).mockResolvedValue({ sid: 'VS_test_sid' });

    await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(sendOtp).toHaveBeenCalledWith(JOHN_PHONE);
    expect(sendOtp).toHaveBeenCalledTimes(1);
  });

  it('works on the manual-fallback path (session with no matched record)', async () => {
    createSession(JOHN_PHONE, null);
    vi.mocked(sendOtp).mockResolvedValue({ sid: 'VS_test_sid' });

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resent).toBe(true);
  });
});

// ── HTTP method enforcement ───────────────────────────────────────────────────

describe('/api/identity/resend-otp — method enforcement', () => {
  it('GET returns 405', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });

  it('PUT returns 405', async () => {
    const res = await PUT();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });

  it('PATCH returns 405', async () => {
    const res = await PATCH();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });

  it('DELETE returns 405', async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('method_not_allowed');
  });
});
