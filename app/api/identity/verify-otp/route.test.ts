/**
 * Tests for POST /api/identity/verify-otp
 *
 * Strategy:
 * - vi.mock lib/twilio so no real Twilio calls are made.
 * - Sessions are now stateless signed tokens: createSession() returns a token
 *   which must be passed in the request body. Failure responses return a
 *   refreshed token carrying the updated attempt counter, so multi-attempt
 *   tests thread that token from each response into the next request.
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
import { createSession } from '../../../../lib/session-cache';
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

/**
 * POST once and return both the parsed body and the refreshed token (if any),
 * so callers can thread the token through repeated failing attempts.
 */
async function postAttempt(phone: string, code: string, token: string) {
  const res = await POST(makeRequest({ phoneNumber: phone, code, sessionToken: token }));
  const body = await res.json();
  return { res, body, nextToken: (body.sessionToken as string | null) ?? token };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
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
    const res = await POST(makeRequest({ code: '123456', sessionToken: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/phoneNumber/);
  });

  it('returns 400 for a non-US phone number', async () => {
    const res = await POST(makeRequest({ phoneNumber: '+447911123456', code: '123456', sessionToken: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for missing code', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, sessionToken: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/code/);
  });

  it('returns 400 for a code that is not 6 digits', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '12345', sessionToken: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for a code with non-numeric characters', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '12345a', sessionToken: 'x' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
  });

  it('returns 400 for a missing sessionToken', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(body.message).toMatch(/sessionToken/);
  });
});

// ── Session checks ────────────────────────────────────────────────────────────

describe('POST /api/identity/verify-otp — session checks', () => {
  it('returns 404 for an invalid/forged session token', async () => {
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: 'not.valid' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('session_not_found');
  });

  it('returns 404 when the token is bound to a different phone number', async () => {
    const token = createSession('+15555550456', JOHN_RECORD);
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));
    expect(res.status).toBe(404);
  });

  it('returns 423 when the session is already locked', async () => {
    let token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    // Exhaust all 5 attempts to trigger the lock, threading the refreshed token
    for (let i = 0; i < 5; i++) {
      const r = await postAttempt(JOHN_PHONE, '999999', token);
      token = r.nextToken;
    }

    // Next request with the now-locked token should be rejected as locked
    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));
    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.error).toBe('locked');
  });
});

// ── Test-number bypass ────────────────────────────────────────────────────────

describe('POST /api/identity/verify-otp — test-number bypass', () => {
  it('approves code "000000" for fixture phone without calling Twilio', async () => {
    const token = createSession(JOHN_PHONE, JOHN_RECORD);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '000000', sessionToken: token }));

    expect(checkOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.prefill).toMatchObject({ firstName: 'John', lastName: 'Smith' });
  });

  it('does NOT bypass for a non-test phone number with code "000000"', async () => {
    const nonTestPhone = '+12025550199';
    const token = createSession(nonTestPhone, null);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const res = await POST(makeRequest({ phoneNumber: nonTestPhone, code: '000000', sessionToken: token }));

    expect(checkOtp).toHaveBeenCalledWith(nonTestPhone, '000000');
    expect(res.status).toBe(422);
  });

  it('does NOT bypass a test phone with a non-bypass code — calls Twilio', async () => {
    const token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));

    expect(checkOtp).toHaveBeenCalledWith(JOHN_PHONE, '123456');
    expect(res.status).toBe(422);
  });
});

// ── OTP failure / attempt counting ───────────────────────────────────────────

describe('POST /api/identity/verify-otp — OTP failures', () => {
  it('returns 422 with attemptsRemaining on first failure', async () => {
    const token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    const { res, body } = await postAttempt(JOHN_PHONE, '999999', token);
    expect(res.status).toBe(422);
    expect(body.error).toBe('otp_invalid');
    expect(body.locked).toBe(false);
    expect(body.attemptsRemaining).toBe(4);
    expect(typeof body.sessionToken).toBe('string');
  });

  it('decrements attemptsRemaining on each failure', async () => {
    let token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    // First failure: 4 remaining; second: 3 remaining
    const first = await postAttempt(JOHN_PHONE, '999999', token);
    token = first.nextToken;
    const { body } = await postAttempt(JOHN_PHONE, '999999', token);
    expect(body.attemptsRemaining).toBe(3);
  });

  it('returns locked:true and attemptsRemaining:0 on the 5th failure', async () => {
    let token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(false);

    let last!: Awaited<ReturnType<typeof postAttempt>>;
    for (let i = 0; i < 5; i++) {
      last = await postAttempt(JOHN_PHONE, '999999', token);
      token = last.nextToken;
    }
    expect(last.res.status).toBe(422);
    expect(last.body.locked).toBe(true);
    expect(last.body.attemptsRemaining).toBe(0);
  });
});

// ── Success — prefill data returned ──────────────────────────────────────────

describe('POST /api/identity/verify-otp — success', () => {
  it('returns 200 with full prefill when Twilio approves', async () => {
    const token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(true);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));
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

  it('does not return a new session token on success (client discards it)', async () => {
    // With stateless tokens there is no server-side deletion on success; the
    // client simply drops the token. The success response therefore carries no
    // refreshed sessionToken.
    const token = createSession(JOHN_PHONE, JOHN_RECORD);
    vi.mocked(checkOtp).mockResolvedValue(true);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessionToken).toBeUndefined();
  });

  it('returns verified:true with prefill:null on the manual-fallback path (no record)', async () => {
    const token = createSession(JOHN_PHONE, null); // manual-fallback session — no matched record
    vi.mocked(checkOtp).mockResolvedValue(true);

    const res = await POST(makeRequest({ phoneNumber: JOHN_PHONE, code: '123456', sessionToken: token }));
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
