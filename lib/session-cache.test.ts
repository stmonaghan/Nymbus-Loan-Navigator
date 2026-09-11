import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSession,
  getSession,
  incrementOtpAttempts,
  clearSession,
  incrementResend,
  _clearAllSessions,
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

// ─── helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearAllSessions();
  vi.useRealTimers(); // reset any fake-timer state
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── createSession / getSession ───────────────────────────────────────────────

describe('createSession + getSession', () => {
  it('creates a session that is immediately retrievable', () => {
    createSession(PHONE, RECORD);
    const session = getSession(PHONE);
    expect(session).not.toBeNull();
    expect(session!.phoneNumber).toBe(PHONE);
    expect(session!.record).toEqual(RECORD);
  });

  it('initialises all counters to zero and locked to false', () => {
    createSession(PHONE, RECORD);
    const session = getSession(PHONE)!;
    expect(session.otpAttempts).toBe(0);
    expect(session.locked).toBe(false);
    expect(session.resendCount).toBe(0);
  });

  it('stores a null record on the manual-fallback path', () => {
    createSession(PHONE, null);
    const session = getSession(PHONE)!;
    expect(session.record).toBeNull();
  });

  it('returns null for an unknown phone number', () => {
    expect(getSession('+10000000000')).toBeNull();
  });

  it('overwrites an existing session when called again', () => {
    createSession(PHONE, RECORD);
    createSession(PHONE, null); // overwrite
    const session = getSession(PHONE)!;
    expect(session.record).toBeNull();
    expect(session.otpAttempts).toBe(0); // counters reset
  });
});

// ─── session expiry (TTL = 10 minutes) ────────────────────────────────────────

describe('session expiry', () => {
  it('returns null after the 10-minute TTL has elapsed', () => {
    vi.useFakeTimers();
    createSession(PHONE, RECORD);

    // Advance just past 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(getSession(PHONE)).toBeNull();
  });

  it('is still valid just before the TTL expires', () => {
    vi.useFakeTimers();
    createSession(PHONE, RECORD);

    vi.advanceTimersByTime(10 * 60 * 1000 - 1);

    expect(getSession(PHONE)).not.toBeNull();
  });
});

// ─── incrementOtpAttempts ─────────────────────────────────────────────────────

describe('incrementOtpAttempts', () => {
  it('increments the attempt counter with each call', () => {
    createSession(PHONE, RECORD);
    const r1 = incrementOtpAttempts(PHONE);
    expect(r1.attempts).toBe(1);
    expect(r1.locked).toBe(false);

    const r2 = incrementOtpAttempts(PHONE);
    expect(r2.attempts).toBe(2);
  });

  it('sets locked=true exactly at the 5th attempt', () => {
    createSession(PHONE, RECORD);
    for (let i = 0; i < 4; i++) {
      const r = incrementOtpAttempts(PHONE);
      expect(r.locked).toBe(false);
    }
    const r5 = incrementOtpAttempts(PHONE);
    expect(r5.attempts).toBe(5);
    expect(r5.locked).toBe(true);
  });

  it('persists the locked flag on subsequent getSession calls', () => {
    createSession(PHONE, RECORD);
    for (let i = 0; i < 5; i++) incrementOtpAttempts(PHONE);
    const session = getSession(PHONE)!;
    expect(session.locked).toBe(true);
  });

  it('returns locked=true and attempts=0 when session does not exist', () => {
    const r = incrementOtpAttempts('+10000000000');
    expect(r.locked).toBe(true);
    expect(r.attempts).toBe(0);
  });
});

// ─── clearSession ─────────────────────────────────────────────────────────────

describe('clearSession', () => {
  it('removes the session so subsequent getSession returns null', () => {
    createSession(PHONE, RECORD);
    clearSession(PHONE);
    expect(getSession(PHONE)).toBeNull();
  });

  it('is a no-op for a non-existent phone number', () => {
    expect(() => clearSession('+10000000000')).not.toThrow();
  });

  it('does not affect other sessions', () => {
    createSession(PHONE, RECORD);
    createSession(PHONE_2, null);
    clearSession(PHONE);
    expect(getSession(PHONE)).toBeNull();
    expect(getSession(PHONE_2)).not.toBeNull();
  });
});

// ─── incrementResend ──────────────────────────────────────────────────────────

describe('incrementResend', () => {
  it('increments resendCount and exceeded=false within limit', () => {
    createSession(PHONE, RECORD);
    const r1 = incrementResend(PHONE);
    expect(r1.resendCount).toBe(1);
    expect(r1.exceeded).toBe(false);

    const r2 = incrementResend(PHONE);
    expect(r2.resendCount).toBe(2);
    expect(r2.exceeded).toBe(false);

    const r3 = incrementResend(PHONE);
    expect(r3.resendCount).toBe(3);
    expect(r3.exceeded).toBe(false);
  });

  it('returns exceeded=true on the 4th resend (> max 3)', () => {
    createSession(PHONE, RECORD);
    for (let i = 0; i < 3; i++) incrementResend(PHONE);
    const r4 = incrementResend(PHONE);
    expect(r4.resendCount).toBe(4);
    expect(r4.exceeded).toBe(true);
  });

  it('returns exceeded=true and resendCount=0 when session does not exist', () => {
    const r = incrementResend('+10000000000');
    expect(r.exceeded).toBe(true);
    expect(r.resendCount).toBe(0);
  });
});
