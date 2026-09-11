/**
 * Per-(phone, IP) rate limiter for the identity/OTP endpoints.
 *
 * Window:       15 minutes (fixed window, resets at createdAt + WINDOW_MS)
 * Max attempts: 5 per (phone, IP) pair per window
 *
 * Replace the in-memory store with Redis in production for multi-instance
 * deployments. The public API surface is identical.
 */

/** Window duration: 15 minutes in milliseconds. */
const WINDOW_MS = 15 * 60 * 1000;

/** Max attempts allowed per (phone, IP) pair within one window. */
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  /** Number of attempts recorded in the current window. */
  attempts: number;
  /** Epoch ms when the current window expires (createdAt + WINDOW_MS). */
  resetAt: number;
}

// ─────────────────────────────────────────────
// Internal store — module-level singleton.
// ─────────────────────────────────────────────
const store = new Map<string, RateLimitEntry>();

/**
 * Build a composite cache key from phone and IP.
 * Keeping this deterministic and private prevents key-format drift.
 */
function makeKey(phone: string, ip: string): string {
  return `${phone}::${ip}`;
}

/**
 * Remove entries whose window has already expired.
 * Called opportunistically on every `checkRateLimit` invocation.
 */
function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Check (and record) one attempt for the given (phone, IP) pair.
 *
 * @param phone - E.164 phone number (e.g. "+15555550123")
 * @param ip    - Caller's IP address (IPv4 or IPv6 string)
 * @returns
 *   - `allowed`   — `false` once the 5-attempt limit is reached; `true` otherwise
 *   - `remaining` — attempts left *after* this call (0 when the call is blocked)
 *   - `resetAt`   — epoch ms when the current window expires
 */
export function checkRateLimit(
  phone: string,
  ip: string
): { allowed: boolean; remaining: number; resetAt: number } {
  purgeExpired();

  const key = makeKey(phone, ip);
  const now = Date.now();

  let entry = store.get(key);

  // Start a fresh window if there is no existing entry.
  if (!entry) {
    entry = { attempts: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  // Window already expired but wasn't caught by purge (edge case): reset it.
  if (entry.resetAt <= now) {
    entry.attempts = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  // Already at or over the limit — don't increment further.
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Record this attempt.
  entry.attempts += 1;

  const remaining = MAX_ATTEMPTS - entry.attempts;
  return { allowed: true, remaining, resetAt: entry.resetAt };
}

/**
 * Exported for tests that need to reset module state between cases.
 * Not part of the production API surface.
 */
export function _resetRateLimits(): void {
  store.clear();
}
