import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, _resetRateLimits } from './rate-limit';

const PHONE = '+15555550123';
const IP    = '203.0.113.42';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes — mirrors the implementation constant

beforeEach(() => {
  _resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic allow / block behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('checkRateLimit — basic allow/block', () => {
  it('allows the first request and returns 4 remaining', () => {
    const result = checkRateLimit(PHONE, IP);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows requests 1–5, blocking nothing until the 6th', () => {
    for (let i = 1; i <= 5; i++) {
      const { allowed } = checkRateLimit(PHONE, IP);
      expect(allowed).toBe(true);
    }
  });

  it('blocks the 6th request in the same window', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);

    const result = checkRateLimit(PHONE, IP);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('remaining decrements correctly across all 5 allowed calls', () => {
    const expectedRemaining = [4, 3, 2, 1, 0];
    for (const expected of expectedRemaining) {
      const { remaining } = checkRateLimit(PHONE, IP);
      expect(remaining).toBe(expected);
    }
  });

  it('provides a resetAt timestamp in the future', () => {
    const now = Date.now();
    const { resetAt } = checkRateLimit(PHONE, IP);
    expect(resetAt).toBeGreaterThan(now);
    // Should be ~15 minutes out (allow a few ms of skew)
    expect(resetAt).toBeLessThanOrEqual(now + WINDOW_MS + 100);
  });

  it('resetAt is stable within the same window', () => {
    const first  = checkRateLimit(PHONE, IP).resetAt;
    vi.advanceTimersByTime(1_000); // 1 second later — still same window
    const second = checkRateLimit(PHONE, IP).resetAt;
    expect(second).toBe(first);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Composite key — independence by (phone, IP) pair
// ─────────────────────────────────────────────────────────────────────────────

describe('checkRateLimit — independent counters per (phone, IP) pair', () => {
  it('different IPs for the same phone have independent counters', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);

    // Exhausted for (PHONE, IP) but a different IP should be fresh.
    const other = checkRateLimit(PHONE, '198.51.100.7');
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(4);
  });

  it('different phones from the same IP have independent counters', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);

    const other = checkRateLimit('+15555550456', IP);
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(4);
  });

  it('completely different pairs do not share state', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);

    const other = checkRateLimit('+15555550789', '198.51.100.99');
    expect(other.allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Window reset behaviour (fake timers)
// ─────────────────────────────────────────────────────────────────────────────

describe('checkRateLimit — window reset after 15 minutes', () => {
  it('allows requests again after the 15-minute window elapses', () => {
    // Exhaust the limit.
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);
    expect(checkRateLimit(PHONE, IP).allowed).toBe(false);

    // Advance clock past the window boundary.
    vi.advanceTimersByTime(WINDOW_MS + 1);

    const result = checkRateLimit(PHONE, IP);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // fresh window: 1 attempt used, 4 left
  });

  it('does not reset before the full 15 minutes have elapsed', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);

    vi.advanceTimersByTime(WINDOW_MS - 1); // 1 ms short of the boundary

    expect(checkRateLimit(PHONE, IP).allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _resetRateLimits helper
// ─────────────────────────────────────────────────────────────────────────────

describe('_resetRateLimits', () => {
  it('clears all stored entries so limits are no longer enforced', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(PHONE, IP);
    expect(checkRateLimit(PHONE, IP).allowed).toBe(false);

    _resetRateLimits();

    expect(checkRateLimit(PHONE, IP).allowed).toBe(true);
  });
});
