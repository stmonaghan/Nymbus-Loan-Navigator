/**
 * Tests for POST /api/identity/verify-otp
 *
 * Strategy:
 * - vi.mock lib/twilio so no real Twilio calls are made.
 * - Use the real session-cache and its _clearAllSessions helper for isolation.
 * - Cover: input validation, session-not-found, locked session, test-number
 *   bypass, Twilio failure/increment/lock, success with prefill, success
 *   without prefill (manual-fallback), and non-POST method rejection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Twilio before importing the route ──────────────────────────────────
vi.mock('../../../../lib/twilio', () => ({
  checkOtp: vi.fn(),
}));

import { POST, GET, PUT, PATCH, DELETE } from './route';
import { createSession, _clearAllSessions } from '../../../../lib/session-cache';
import { checkOtp } from '../../../../lib/twilio';
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
  return new NextRequest('http://localhost/api/identity/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearAllSessions();
  vi.mocked(checkOtp).mockReset();
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('POST /api/identity/verify-otp — input validation', () => {
  it('returns 400 for non-JSON body', async () => {
    const req = new NextRequest('http://localhost/api/identity/verify-otp', {
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
    const res = await POST(makeRequest({ code: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/phoneNumber/);
  });

  it('returns 400 for a non-US phone number', async () => {
    const res = await POST(makeRequest({ phoneNumber: '+447911123456', code: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for missing code', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/code/);
  });

  it('returns 400 for a code that is not 6 digits', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '12345' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for a code with non-numeric characters', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '12345a' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });
});

// ── Session checks ────────────────────────────────────────────────────────────

describe('POST /api/identity/verify-otp — session checks', () => {
  it('returns 404 when no session exists for the phone', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('session_not_found');
  });

  it('returns 423 when the session is already locked', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);

    // Exhaust all 5 attempts to trigger the lock
    vi.mocked(checkOtp).mockResolvedValue(false);
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '999999' }));
    }

    // Next request should see the locked session
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.error).toBe('locked');
  });
});

// ── Test-number bypass ────────────────────────────────────────────────────────

describe('POST /api/identity/verify-otp — test-number bypass', () => {
  it('approves code "000000" for fixture phone without calling Twilio', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '000000' }));

    expect(checkOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.prefill).toMatchObject({ firstName: 'John', lastName: 'Smith' });
  });

  it('does NOT bypass for a non-test phone number with code "000000"', async () => {
    const nonTestPhone = '+12025550199';
    createSession(nonTestPhone, null);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const res = await POST(makeRequest({ phoneNumber: nonTestPhone, code: '000000' }));

    expect(checkOtp).toHaveBeenCalledWith(nonTestPhone, '000000');
    expect(res.status).toBe(422);
  });

  it('does NOT bypass a test phone with a non-bypass code — calls Twilio', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));

    expect(checkOtp).toHaveBeenCalledWith(JOHN_PHONE, '123456');
    expect(res.status).toBe(422);
  });
});

// ── OTP failure / attempt counting ───────────────────────────────────────────

describe('POST /api/identity/verify-otp — OTP failures', () => {
  it('returns 422 with attemptsRemaining on first failure', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '999999' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('otp_invalid');
    expect(body.locked).toBe(false);
    expect(body.attemptsRemaining).toBe(4);
  });

  it('decrements attemptsRemaining on each failure', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    // First failure: 4 remaining; second: 3 remaining
    await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '999999' }));
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '999999' }));
    const body = await res.json();
    expect(body.attemptsRemaining).toBe(3);
  });

  it('returns locked:true and attemptsRemaining:0 on the 5th failure', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    let res!: Response;
    for (let i = 0; i < 5; i++) {
      res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '999999' }));
    }
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.locked).toBe(true);
    expect(body.attemptsRemaining).toBe(0);
  });
});

// ── Success — prefill data returned ──────────────────────────────────────────

describe('POST /api/identity/verify-otp — success', () => {
  it('returns 200 with full prefill when Twilio approves', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(true);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.prefill).toEqual({
      firstName: 'John',
      lastName: 'Smith',
      dob: '1990-04-12',
      addressLine1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      email: 'john.smith@example.com',
    });
  });

  it('clears the session after successful verification', async () => {
    createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(true);

    await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));

    // A subsequent request for the same phone should find no session
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(404);
  });

  it('returns verified:true with prefill:null on the manual-fallback path (no record)', async () => {
    createSession(JOHN_PHONE, null); // manual-fallback session — no matched record
    vi.mocked(checkOtp).mockResolvedValue(true);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.prefill).toBeNull();
  });
});

// ── HTTP method enforcement ───────────────────────────────────────────────────

describe('/api/identity/verify-otp — method enforcement', () => {
  it('GET returns 405', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it('PUT returns 405', async () => {
    const res = await PUT();
    expect(res.status).toBe(405);
  });

  it('PATCH returns 405', async () => {
    const res = await PATCH();
    expect(res.status).toBe(405);
  });

  it('DELETE returns 405', async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
  });
});
