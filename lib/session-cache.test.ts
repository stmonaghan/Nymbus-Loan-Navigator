import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSession,
  getSession,
  incrementOtpAttempts,
  clearSession,
  incrementResend,
} from './session-cache';
import type { MNORecord } from './mno-mock';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PHONE = '+15555550123';
const PHONE_2 = '+15555550456';

const RECORD: MNORecord = {
  firstName: 'John',
  lastName: 'Smith',
  dob: '1990-04-12',
  addressLine1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  email: 'john.smith@example.com',
};

afterEach(() => {
  vi.useRealTimers();
});

// ─── createSession / getSession ───────────────────────────────────────────────

describe('createSession + getSession', () => {
  it('creates a token that decodes back to a valid session', () => {
    const token = createSession(PHONE, RECORD);
    const session = getSession(PHONE, token);
    expect(session).not.toBeNull();
    expect(session!.phoneNumber).toBe(PHONE);
    expect(session!.record).toEqual(RECORD);
  });

  it('initialises all counters to zero and locked to false', () => {
    const token = createSession(PHONE, RECORD);
    const session = getSession(PHONE, token)!;
    expect(session.otpAttempts).toBe(0);
    expect(session.locked).toBe(false);
    expect(session.resendCount).toBe(0);
  });

  it('stores a null record on the manual-fallback path', () => {
    const token = createSession(PHONE, null);
    const session = getSession(PHONE, token)!;
    expect(session.record).toBeNull();
  });

  it('returns null for a missing token', () => {
    expect(getSession(PHONE, null)).toBeNull();
    expect(getSession(PHONE, undefined)).toBeNull();
    expect(getSession(PHONE, '')).toBeNull();
  });

  it('returns null when the token is bound to a different phone number', () => {
    const token = createSession(PHONE, RECORD);
    expect(getSession(PHONE_2, token)).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(getSession(PHONE, 'not-a-real-token')).toBeNull();
    expect(getSession(PHONE, 'only.two.but.wrong')).toBeNull();
  });

  it('returns null when the token signature is tampered with', () => {
    const token = createSession(PHONE, RECORD);
    const [payload] = token.split('.');
    const forged = `${payload}.deadbeef`;
    expect(getSession(PHONE, forged)).toBeNull();
  });

  it('returns null when the payload is tampered with (signature no longer matches)', () => {
    const token = createSession(PHONE, RECORD);
    const [, sig] = token.split('.');
    // Swap in a payload that encodes a different phone number.
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...RECORD, phoneNumber: PHONE_2, expiresAt: Date.now() + 10000 })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(getSession(PHONE_2, `${forgedPayload}.${sig}`)).toBeNull();
  });
});

// ─── session expiry (TTL = 10 minutes) ────────────────────────────────────────

describe('session expiry', () => {
  it('returns null after the 10-minute TTL has elapsed', () => {
    vi.useFakeTimers();
    const token = createSession(PHONE, RECORD);

    // Advance just past 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(getSession(PHONE, token)).toBeNull();
  });

  it('is still valid just before the TTL expires', () => {
    vi.useFakeTimers();
    const token = createSession(PHONE, RECORD);

    vi.advanceTimersByTime(10 * 60 * 1000 - 1);

    expect(getSession(PHONE, token)).not.toBeNull();
  });
});

// ─── incrementOtpAttempts ─────────────────────────────────────────────────────

describe('incrementOtpAttempts', () => {
  it('increments the attempt counter and returns a refreshed token', () => {
    let session = getSession(PHONE, createSession(PHONE, RECORD));
    const r1 = incrementOtpAttempts(session);
    expect(r1.attempts).toBe(1);
    expect(r1.locked).toBe(false);
    expect(r1.token).not.toBeNull();

    // Decode the refreshed token and increment again.
    session = getSession(PHONE, r1.token);
    const r2 = incrementOtpAttempts(session);
    expect(r2.attempts).toBe(2);
  });

  it('sets locked=true exactly at the 5th attempt', () => {
    let session = getSession(PHONE, createSession(PHONE, RECORD));
    for (let i = 0; i < 4; i++) {
      const r = incrementOtpAttempts(session);
      expect(r.locked).toBe(false);
      session = getSession(PHONE, r.token);
    }
    const r5 = incrementOtpAttempts(session);
    expect(r5.attempts).toBe(5);
    expect(r5.locked).toBe(true);
  });

  it('persists the locked flag in the refreshed token', () => {
    let session = getSession(PHONE, createSession(PHONE, RECORD));
    let token: string | null = null;
    for (let i = 0; i < 5; i++) {
      const r = incrementOtpAttempts(session);
      token = r.token;
      session = getSession(PHONE, token);
    }
    expect(getSession(PHONE, token)!.locked).toBe(true);
  });

  it('returns locked=true, attempts=0, token=null when session is null', () => {
    const r = incrementOtpAttempts(null);
    expect(r.locked).toBe(true);
    expect(r.attempts).toBe(0);
    expect(r.token).toBeNull();
  });
});

// ─── clearSession ─────────────────────────────────────────────────────────────

describe('clearSession', () => {
  it('is a no-op and does not throw (stateless — token discarded client-side)', () => {
    expect(() => clearSession(PHONE)).not.toThrow();
  });
});

// ─── incrementResend ──────────────────────────────────────────────────────────

describe('incrementResend', () => {
  it('increments resendCount and exceeded=false within limit', () => {
    let session = getSession(PHONE, createSession(PHONE, RECORD));

    const r1 = incrementResend(session);
    expect(r1.resendCount).toBe(1);
    expect(r1.exceeded).toBe(false);
    session = getSession(PHONE, r1.token);

    const r2 = incrementResend(session);
    expect(r2.resendCount).toBe(2);
    expect(r2.exceeded).toBe(false);
    session = getSession(PHONE, r2.token);

    const r3 = incrementResend(session);
    expect(r3.resendCount).toBe(3);
    expect(r3.exceeded).toBe(false);
  });

  it('returns exceeded=true on the 4th resend (> max 3)', () => {
    let session = getSession(PHONE, createSession(PHONE, RECORD));
    for (let i = 0; i < 3; i++) {
      const r = incrementResend(session);
      session = getSession(PHONE, r.token);
    }
    const r4 = incrementResend(session);
    expect(r4.resendCount).toBe(4);
    expect(r4.exceeded).toBe(true);
  });

  it('returns exceeded=true, resendCount=0, token=null when session is null', () => {
    const r = incrementResend(null);
    expect(r.exceeded).toBe(true);
    expect(r.resendCount).toBe(0);
    expect(r.token).toBeNull();
  });
});
