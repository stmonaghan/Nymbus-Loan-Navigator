import { createHmac, timingSafeEqual } from 'crypto';

import type { MNORecord } from './mno-mock';

/** TTL for each session: 10 minutes in milliseconds. */
const SESSION_TTL_MS = 10 * 60 * 1000;

/** Max OTP attempts before the session is locked. */
const MAX_OTP_ATTEMPTS = 5;

/** Max resend requests per session. */
const MAX_RESENDS = 3;

export interface SessionEntry {
  /** E.164 phone number — binds the token to a single number. */
  phoneNumber: string;
  /** Matched MNO record; null on the manual-fallback path. */
  record: MNORecord | null;
  /** Epoch ms when this session expires (createdAt + 10 min). */
  expiresAt: number;
  /** Number of incorrect OTP attempts so far (0–5). */
  otpAttempts: number;
  /** True once otpAttempts reaches MAX_OTP_ATTEMPTS. */
  locked: boolean;
  /** Number of resend-OTP requests made for this session (0–3). */
  resendCount: number;
}

// ─────────────────────────────────────────────
// Stateless, signed-token session storage.
//
// WHY THIS EXISTS
// ---------------
// The previous implementation kept sessions in an in-process `Map`. That works
// in a single long-lived Node process (local `next dev`, `next start`) but
// breaks on Vercel: `/api/identity/match` and `/api/identity/verify-otp` can
// run in *separate* serverless instances that do not share memory, so a session
// written by one is invisible to the other — surfacing as "session timed out".
//
// Instead we encode the whole session into a signed, expiring token that the
// client holds and returns on each subsequent call. No shared server state, so
// it works across any number of serverless invocations with zero extra infra.
//
// Token format:  base64url(payloadJson) + "." + base64url(hmacSha256)
// The HMAC (keyed by SESSION_SECRET) makes the payload tamper-evident: a client
// cannot alter the phone number, record, expiry, or counters without
// invalidating the signature.
//
// SECURITY NOTE / TRADEOFF
// ------------------------
// Because the client holds the token, it can *replay an older token* to reset
// the app-level otpAttempts/resendCount counters. These counters are therefore
// a secondary, best-effort guard only. The authoritative brute-force and
// code-expiry protection is enforced server-side by Twilio Verify (max check
// attempts + code TTL), which this app cannot bypass. The token payload never
// contains the OTP code itself — Twilio owns that. For hard server-side
// enforcement of these counters, back this with Vercel KV / Upstash Redis
// keyed by phone number.
// ─────────────────────────────────────────────

/**
 * The signing key. In production set SESSION_SECRET to a long random string.
 * We fall back to a fixed dev-only value so local runs work without config,
 * but log a warning so it is not silently relied on in production.
 */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    // Do not throw (that would take down the route); warn loudly instead.
    console.warn(
      '[session-cache] SESSION_SECRET is not set in production. ' +
        'Session tokens are signed with an insecure default key.'
    );
  }
  return 'dev-only-insecure-session-secret-change-me';
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function sign(payloadB64: string): string {
  return base64urlEncode(
    createHmac('sha256', getSecret()).update(payloadB64).digest()
  );
}

/**
 * Serialize a session entry into a signed token string.
 */
function encodeToken(entry: SessionEntry): string {
  const payloadB64 = base64urlEncode(JSON.stringify(entry));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify + parse a token back into a SessionEntry.
 * Returns null if the token is malformed, tampered, or expired.
 */
function decodeToken(token: string): SessionEntry | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  // Constant-time signature comparison.
  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let entry: SessionEntry;
  try {
    entry = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof entry.expiresAt !== 'number' || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry;
}

// ─────────────────────────────────────────────
// Public API
//
// The store is now stateless, so functions take/return a token instead of
// mutating shared memory keyed by phone number. Callers must persist the
// returned token (send it to the client) and pass it back on the next call.
// ─────────────────────────────────────────────

/**
 * Create a fresh session for the given phone number and return its signed
 * token. Resets all counters and starts a 10-minute TTL.
 */
export function createSession(
  phone: string,
  record: MNORecord | null
): string {
  const now = Date.now();
  return encodeToken({
    phoneNumber: phone,
    record,
    expiresAt: now + SESSION_TTL_MS,
    otpAttempts: 0,
    locked: false,
    resendCount: 0,
  });
}

/**
 * Verify + decode a session token, checking that it belongs to `phone`.
 * Returns null if the token is missing, invalid, expired, or bound to a
 * different phone number.
 */
export function getSession(
  phone: string,
  token: string | null | undefined
): SessionEntry | null {
  if (!token) return null;
  const entry = decodeToken(token);
  if (!entry) return null;
  if (entry.phoneNumber !== phone) return null;
  return entry;
}

/**
 * Increment the OTP-attempt counter on a session.
 * Sets `locked = true` when the counter reaches MAX_OTP_ATTEMPTS.
 *
 * Returns the updated `{ attempts, locked }` plus a fresh `token` encoding the
 * new state, or `{ attempts: 0, locked: true, token: null }` if the incoming
 * session is invalid/expired.
 */
export function incrementOtpAttempts(
  session: SessionEntry | null
): { attempts: number; locked: boolean; token: string | null } {
  if (!session || session.expiresAt <= Date.now()) {
    return { attempts: 0, locked: true, token: null };
  }

  const attempts = session.otpAttempts + 1;
  const locked = attempts >= MAX_OTP_ATTEMPTS;
  const updated: SessionEntry = { ...session, otpAttempts: attempts, locked };
  return { attempts, locked, token: encodeToken(updated) };
}

/**
 * Increment the resend counter on a session.
 * Returns the updated `{ resendCount, exceeded }` plus a fresh `token`, or
 * `{ resendCount: 0, exceeded: true, token: null }` if the session is invalid.
 */
export function incrementResend(
  session: SessionEntry | null
): { resendCount: number; exceeded: boolean; token: string | null } {
  if (!session || session.expiresAt <= Date.now()) {
    return { resendCount: 0, exceeded: true, token: null };
  }

  const resendCount = session.resendCount + 1;
  const updated: SessionEntry = { ...session, resendCount };
  return {
    resendCount,
    exceeded: resendCount > MAX_RESENDS,
    token: encodeToken(updated),
  };
}

/**
 * With stateless tokens there is no server-side entry to delete on successful
 * verification — the client simply discards the token. Kept as a no-op so
 * call sites read clearly and to preserve the public API shape.
 */
export function clearSession(_phone: string): void {
  // no-op: stateless tokens are discarded client-side
}
