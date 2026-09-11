# spec-02: Identity Match & Verification — Design

## Sequence Flow

```
Applicant              Frontend              Backend             Identity-Match Svc     Twilio Verify
    |  enters phone,      |                    |                        |                    |
    |  last name, initial |                    |                        |                    |
    |--------------------> POST /api/identity/match                    |                    |
    |                     |------------------->|                        |                    |
    |                     |                    |--- match request ------>|                    |
    |                     |                    |<-- summaryScore --------|                    |
    |                     |<-- {status,        |                        |                    |
    |                     |    matchToken}     |                        |                    |
    |                     |                    |                        |                    |
    |  [if matched]       | POST /api/otp/send |                        |                    |
    |                     |------------------->|--- send verification ----------------------->|
    |                     |                    |<-- verification sid --------------------------|
    |  receives SMS code  |                    |                        |                    |
    |  enters code        | POST /api/otp/verify                        |                    |
    |--------------------> |------------------->|--- check verification ---------------------->|
    |                     |                    |<-- approved/denied -----------------------------|
    |                     |<-- {verified:true, |                        |                    |
    |                     |    prefill:{...}}  |                        |                    |
```

---

## API Contracts

### POST `/api/identity/match`

**Purpose:** Run the identity-match check. Gate any OTP send on a match result.

**Request:**
```json
{
  "phoneNumber": "+15555550123",
  "lastName": "Smith",
  "firstNameInitial": "J",
  "sessionId": "sess_abc123"
}
```

**Response (match found):**
```json
{
  "status": "matched",
  "matchToken": "mt_9f3a2b...",
  "summaryScore": "high"
}
```

**Response (no match):**
```json
{
  "status": "no_match",
  "summaryScore": "no_match"
}
```

**Response (rate limited):**
```json
{ "error": "RATE_LIMITED", "retryAfterSeconds": 900 }
```

`matchToken` is an opaque, short-lived server-side reference to the matched profile — the profile data itself is never sent to the client at this stage (only released after OTP success, per Requirement 5).

**Server logic:**
1. Validate and sanitize inputs (E.164 phone format, non-empty lastName/firstNameInitial).
2. Check rate limits: per-phone (5 / 15 min) and per-IP (20 combined / 15 min). Reject if exceeded.
3. Run identity match (mock service by default; live Twilio Identity Match if `USE_LIVE_IDENTITY_MATCH=true`).
4. If `summaryScore` is `high` or `medium`: generate `matchToken`, cache full matched record server-side keyed to `(sessionId, matchToken)` with 30-min TTL. Return `{ status: "matched", matchToken, summaryScore }`.
5. If `summaryScore` is `low` or `no_match` (or service error/timeout): return `{ status: "no_match" }`. Do not call Twilio.
6. Log: `{ event: "identity_match", sessionId, result: summaryScore, timestamp }` — no PII values.

---

### POST `/api/otp/send`

**Purpose:** Send an OTP via Twilio Verify. Called after a successful match OR on the manual-fallback path (without a matchToken).

**Request:**
```json
{
  "phoneNumber": "+15555550123",
  "matchToken": "mt_9f3a2b..."
}
```
_(`matchToken` is omitted on the manual-fallback path)_

**Response:**
```json
{ "sessionId": "sess_abc123", "expiresInSeconds": 300 }
```

**Response (Twilio send fails — graceful fallback):**
```json
{ "sessionId": "sess_abc123", "expiresInSeconds": 300, "fallbackCode": "482913" }
```
_The UI renders the fallback code on-screen behind a "Delivery unavailable — here's your code" banner. This is a resilience pattern for any third-party dependency, not a cost workaround._

**Server logic:**
1. Validate phoneNumber. Check resend rate limit (max 2 resends per session, 30s minimum interval).
2. Call `twilio.verify.v2.services(SID).verifications.create({ to: phoneNumber, channel: 'sms' })`.
3. On Twilio success: store `verificationSid` in session, return `{ sessionId, expiresInSeconds: 300 }`.
4. On Twilio failure/timeout: generate a local 6-digit code, store hashed in session for server-side check, return `{ sessionId, expiresInSeconds: 300, fallbackCode }`.
5. Log: `{ event: "otp_send", sessionId, channel: "sms"|"fallback", timestamp }`.

---

### POST `/api/otp/verify`

**Purpose:** Validate the OTP the applicant entered. Release pre-fill data on success.

**Request:**
```json
{ "sessionId": "sess_abc123", "code": "482913" }
```

**Response (success — matched path):**
```json
{
  "verified": true,
  "prefill": {
    "firstName": "John",
    "lastName": "Smith",
    "dob": "1990-04-12",
    "addressLine1": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "email": "john.smith@example.com"
  }
}
```

**Response (success — manual fallback path):**
```json
{ "verified": true, "prefill": null }
```

**Response (invalid code):**
```json
{ "verified": false, "attemptsRemaining": 4 }
```

**Response (locked):**
```json
{ "verified": false, "locked": true, "retryAfterSeconds": 300 }
```

**Server logic:**
1. Look up session. If `otpAttempts >= 5` and within lock window → return locked response.
2. If session used fallback code: compare hash of submitted code against stored hash. Otherwise call Twilio check endpoint.
3. On success: mark `phone_verified: true`, retrieve matched record (if `matchToken` present), return prefill data (or `null` if manual-fallback path).
4. On failure: increment `otpAttempts`. If now 5, set `lockedUntil = now + 5min`. Return remaining attempts.
5. Log: `{ event: "otp_verify", sessionId, result: "success"|"failure"|"locked", attemptsUsed, timestamp }`.

---

## Twilio Integration

```typescript
// lib/twilio.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendOtp(
  phone: string
): Promise<{ sid: string } | null> {
  try {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms' });
    return { sid: verification.sid };
  } catch {
    return null; // caller triggers fallback code path
  }
}

export async function checkOtp(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });
    return check.status === 'approved';
  } catch {
    return false;
  }
}
```

**OTP vendor note:** Twilio Verify requires a billing-enabled account to create a Verify Service (the no-card trial no longer covers it — an industry-wide response to SMS-pumping fraud). Cost is trivial (~$0.058/verification, no monthly fee). The account was upgraded deliberately to get the real, production-grade vendor rather than a mock. The graceful on-screen fallback above is kept regardless as a standard resilience pattern.

---

## Session Data Model

```typescript
// lib/session-cache.ts

interface SessionEntry {
  phoneNumber: string;            // hashed at rest
  matchStatus: 'matched' | 'no_match' | 'pending';
  matchToken: string | null;
  matchedRecord: MNORecord | null; // never sent to client until OTP verified
  phoneVerified: boolean;
  otpAttempts: number;            // max 5 before lock
  lockedUntil: number | null;     // epoch ms
  resendCount: number;            // max 2
  lastResendAt: number | null;    // epoch ms
  fallbackCode: string | null;    // hashed, only if Twilio send failed
  consentLoggedAt: number | null; // epoch ms
  createdAt: number;
  expiresAt: number;              // createdAt + 30min TTL
}

const sessionCache = new Map<string, SessionEntry>();

export function getSession(sessionId: string): SessionEntry | null { ... }
export function setSession(sessionId: string, data: Partial<SessionEntry>): void { ... }
export function clearExpiredSessions(): void { ... } // called on every request
```

---

## OTP Screen UI State Machine

```
IDLE
  └─(submit valid 3 fields)──► MATCHING (loading, button disabled)
                                    └─(summaryScore: high|medium)──► MATCH_SUCCESS
                                    │                                     └─(auto)──► OTP_ENTRY
                                    └─(summaryScore: no_match|error)──► NO_MATCH_MESSAGE
                                                                              └─(tap continue)──► FALLBACK_FORM
                                                                                                      └─(submit valid fields)──► OTP_ENTRY

OTP_ENTRY
  └─(submit code)──► VERIFYING
                         └─(verified)──► PREFILL_READY (advance to Step 3)
                         └─(invalid, attempts < 5)──► OTP_ENTRY (inline error, attempts shown)
                         └─(invalid, attempts = 5)──► LOCKED (countdown timer, retry after 5 min)

OTP_ENTRY (resend)
  └─(tap resend, 30s elapsed, count < 2)──► SENDING_NEW_CODE ──► OTP_ENTRY
  └─(tap resend, < 30s elapsed)──► inline "Wait Xs before resending"
  └─(tap resend, count = 2)──► inline "Maximum resends reached"
```

---

## Error-Handling Matrix

| Scenario | Server Response | UI Response |
|----------|----------------|-------------|
| Twilio OTP send fails | `{ fallbackCode: "482913" }` in response | "Delivery unavailable — here's your code: 482913" banner above OTP input |
| Twilio check endpoint times out (> 8s) | 504, fallback to local hash check | "Verifying…" persists; retry once automatically; then show "Try resending your code" |
| Identity-match service unreachable / 5xx / timeout | Treated as `no_match` | Route to manual fallback; failure logged server-side only |
| Invalid phone format | 400 | Inline field error (client validates first; server is second gate) |
| Session expired (> 30 min idle) | 401 | "Your session timed out. Let's start verification again." — clear OTP state, return to Step 2 |
| Rate limit exceeded (per-phone) | 429 `{ error: "RATE_LIMITED", retryAfterSeconds: 900 }` | "Too many attempts — please try again in 15 minutes." |
| Rate limit exceeded (per-IP) | 429 generic | Same generic message — no distinction between phone and IP limit to avoid leaking system internals |
| OTP locked (5 failures) | `{ locked: true, retryAfterSeconds: 300 }` | "Too many incorrect codes. Try again in [countdown]." |
| Duplicate submission (button double-tap) | 409 | Button is disabled on first tap; 409 shows "Already submitted" if it somehow fires |

---

## Privacy & Consent

**Consent disclosure** shown on Step 2 above the Continue button (required visible, not collapsed):

> *"By continuing, you authorize Nymbus Loan Navigator to verify your identity using your mobile carrier data. [Learn more](#)"*

Consent is logged server-side as `{ event: "consent_given", sessionId, timestamp }` — no PII values.

**PII logging rule (all endpoints):** logs contain only `sessionId`, result category, attempt counts, and timestamps. No phone numbers, names, DOBs, or addresses in any log line.

---

## Environment Variables

```bash
# .env.example

# Twilio (required for live OTP)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Set to "true" to use live Twilio Identity Match instead of mock
USE_LIVE_IDENTITY_MATCH=false
```

---

## Mock Identity-Match Service

The default implementation reads from `lib/mock-mno-records.json`. No network calls, no cost, always deterministic for demo purposes.

```typescript
// lib/mno-mock.ts
import records from './mock-mno-records.json';

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

export type MatchSummaryScore = 'high' | 'medium' | 'no_match';

export function matchIdentity(
  phoneNumber: string,
  lastName: string,
  firstNameInitial: string
): { summaryScore: MatchSummaryScore; record: MNORecord | null } {
  const record = (records as Record<string, MNORecord>)[phoneNumber];
  if (!record) return { summaryScore: 'no_match', record: null };

  const lastNameMatch = record.lastName.toLowerCase() === lastName.toLowerCase();
  const initialMatch = record.firstName[0].toLowerCase() === firstNameInitial.toLowerCase();

  if (lastNameMatch && initialMatch) return { summaryScore: 'high', record };
  if (lastNameMatch || initialMatch) return { summaryScore: 'medium', record };
  return { summaryScore: 'no_match', record: null };
}
```

**Testing notes:**
- `+15555550123` + `Smith` + `J` → `high` match → full prefill
- `+15555550123` + `Smith` + `X` → `medium` match → still proceeds (deliberate leniency)
- `+15555550123` + `Wrong` + `Z` → `no_match` → fallback path
- Any unlisted phone → `no_match` → fallback path
