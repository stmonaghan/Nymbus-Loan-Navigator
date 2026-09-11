import type { MNORecord } from './mno-mock';

/** TTL for each session: 10 minutes in milliseconds. */
const SESSION_TTL_MS = 10 * 60 * 1000;

/** Max OTP attempts before the session is locked. */
const MAX_OTP_ATTEMPTS = 5;

/** Max resend requests per session. */
const MAX_RESENDS = 3;

export interface SessionEntry {
  /** E.164 phone number — this is also the cache key. */
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
// Internal store — survives Next.js hot-reload in dev by attaching to
// globalThis. In production the module is loaded once and never reloaded,
// so this has no effect there.
// Replace with Redis / a proper TTL cache for multi-instance deployments.
// ─────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __sessionStore: Map<string, SessionEntry> | undefined;
}

const store: Map<string, SessionEntry> =
  globalThis.__sessionStore ?? (globalThis.__sessionStore = new Map());

/**
 * Remove every session whose `expiresAt` is in the past.
 * Called opportunistically on every mutating operation.
 */
function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Create (or overwrite) a session for the given phone number.
 * Resets all counters and starts a fresh 10-minute TTL.
 */
export function createSession(phone: string, record: MNORecord | null): void {
  purgeExpired();
  const now = Date.now();
  store.set(phone, {
    phoneNumber: phone,
    record,
    expiresAt: now + SESSION_TTL_MS,
    otpAttempts: 0,
    locked: false,
    resendCount: 0,
  });
}

/**
 * Retrieve an active session.
 * Returns `null` if not found or if the TTL has elapsed.
 */
export function getSession(phone: string): SessionEntry | null {
  purgeExpired();
  const entry = store.get(phone);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(phone);
    return null;
  }
  return entry;
}

/**
 * Increment the OTP-attempt counter.
 * Sets `locked = true` when the counter reaches MAX_OTP_ATTEMPTS.
 *
 * Returns `{ attempts, locked }` after the increment.
 * Returns `{ attempts: 0, locked: true }` if the session doesn't exist.
 */
export function incrementOtpAttempts(
  phone: string
): { attempts: number; locked: boolean } {
  purgeExpired();
  const entry = store.get(phone);
  if (!entry || entry.expiresAt <= Date.now()) {
    return { attempts: 0, locked: true };
  }

  entry.otpAttempts += 1;
  if (entry.otpAttempts >= MAX_OTP_ATTEMPTS) {
    entry.locked = true;
  }
  return { attempts: entry.otpAttempts, locked: entry.locked };
}

/**
 * Remove a session entirely (call on successful OTP verification).
 */
export function clearSession(phone: string): void {
  store.delete(phone);
}

/**
 * Increment the resend counter for an existing session.
 * Returns `{ resendCount, exceeded }` where `exceeded` is true
 * when the new count exceeds MAX_RESENDS.
 *
 * Returns `{ resendCount: 0, exceeded: true }` if the session doesn't exist.
 */
export function incrementResend(
  phone: string
): { resendCount: number; exceeded: boolean } {
  purgeExpired();
  const entry = store.get(phone);
  if (!entry || entry.expiresAt <= Date.now()) {
    return { resendCount: 0, exceeded: true };
  }

  entry.resendCount += 1;
  return {
    resendCount: entry.resendCount,
    exceeded: entry.resendCount > MAX_RESENDS,
  };
}

/**
 * Exported for tests that need to reset module state between cases.
 * Not part of the production API surface.
 */
export function _clearAllSessions(): void {
  store.clear();
}
