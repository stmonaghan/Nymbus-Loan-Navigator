import { readFileSync } from 'fs';
import { join } from 'path';

import baseRecords from './mock-mno-records.json';

export interface MNORecord {
  firstName: string;
  lastName: string;
  dob: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  email: string;
}

// ─────────────────────────────────────────────
// Optional overlays (two sources, both optional)
//
// The committed fixture can be extended without committing real phone numbers:
//
//   1. lib/mock-mno-records.local.json  — a gitignored file, for local dev.
//   2. MNO_LOCAL_OVERLAY_JSON env var    — the same JSON shape as a string,
//      for deployed environments like Vercel where there is no writable/
//      committed local file.
//
// Both merge on top of the committed fixture, with precedence:
//   base fixture  <  local file  <  env var
// so the env overlay wins on key collision. Either source being absent is a
// silent no-op; malformed input logs a dev-time warning and is skipped (never
// breaks the build or a request).
//
// Overlays are read once at module load. matchIdentity is only ever called
// server-side (from the API routes), so reading the filesystem here is safe.
// ─────────────────────────────────────────────
/** Narrow an unknown parsed value to an overlay object, or null if unusable. */
function asOverlayObject(
  parsed: unknown,
  sourceLabel: string
): Record<string, MNORecord> | null {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, MNORecord>;
  }
  console.warn(`[mno-mock] ${sourceLabel} is not a JSON object — ignoring.`);
  return null;
}

/**
 * Load the optional local overlay file (lib/mock-mno-records.local.json).
 * Absent file → silent no-op. Malformed JSON → dev-time warning, then skipped.
 */
function loadFileOverlay(): Record<string, MNORecord> {
  try {
    const localPath = join(process.cwd(), 'lib', 'mock-mno-records.local.json');
    const raw = readFileSync(localPath, 'utf8');
    return asOverlayObject(JSON.parse(raw), 'mock-mno-records.local.json') ?? {};
  } catch (err: unknown) {
    // ENOENT (file absent) is the expected common case — stay silent.
    // Anything else (e.g. malformed JSON) is worth a dev-time warning.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('[mno-mock] Could not load mock-mno-records.local.json:', err);
    }
    return {};
  }
}

/**
 * Load the optional env-var overlay (MNO_LOCAL_OVERLAY_JSON), a string holding
 * the same JSON shape as the local file. This is the Vercel-friendly path:
 * set it as an environment variable so a real phone number can be tested in a
 * deployed environment without ever committing it.
 * Unset → silent no-op. Malformed JSON → dev-time warning, then skipped.
 */
function loadEnvOverlay(): Record<string, MNORecord> {
  const raw = process.env.MNO_LOCAL_OVERLAY_JSON;
  if (!raw || raw.trim().length === 0) {
    return {};
  }
  try {
    return asOverlayObject(JSON.parse(raw), 'MNO_LOCAL_OVERLAY_JSON') ?? {};
  } catch (err: unknown) {
    console.warn('[mno-mock] Could not parse MNO_LOCAL_OVERLAY_JSON:', err);
    return {};
  }
}

// Merge order: committed fixture → local file overlay → env-var overlay.
// Later sources win on key collision, so the env overlay takes precedence.
const records: Record<string, MNORecord> = {
  ...(baseRecords as Record<string, MNORecord>),
  ...loadFileOverlay(),
  ...loadEnvOverlay(),
};

export type MatchSummaryScore = 'high' | 'medium' | 'no_match';

export interface MatchResult {
  summaryScore: MatchSummaryScore;
  record: MNORecord | null;
}

/**
 * Checks a phone number + partial name against the mock MNO fixture.
 *
 * Scoring:
 *   - Phone not found                          → no_match
 *   - lastName AND firstNameInitial both match → high
 *   - Only one of the two matches              → medium
 *   - Neither matches                          → no_match
 *
 * Match is case-insensitive for both lastName and firstNameInitial.
 * The full MNORecord is returned for high/medium; null for no_match.
 */
export function matchIdentity(
  phoneNumber: string,
  lastName: string,
  firstNameInitial: string
): MatchResult {
  const record = records[phoneNumber];

  if (!record) {
    return { summaryScore: 'no_match', record: null };
  }

  const lastNameMatch =
    record.lastName.toLowerCase() === lastName.toLowerCase();
  const initialMatch =
    record.firstName[0].toLowerCase() === firstNameInitial[0].toLowerCase();

  if (lastNameMatch && initialMatch) {
    return { summaryScore: 'high', record };
  }

  if (lastNameMatch || initialMatch) {
    return { summaryScore: 'medium', record };
  }

  return { summaryScore: 'no_match', record: null };
}
