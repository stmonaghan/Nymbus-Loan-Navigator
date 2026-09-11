# spec-02: Identity Match & Verification — Requirements

## Introduction

This feature replaces a traditional "type your entire application" identity step with a minimal-entry flow: the applicant provides only a phone number, last name, and first initial. The system checks that combination against a carrier/MNO-style identity-match source, and — only on a match — sends an SMS one-time code. On successful code entry, the system pre-fills the remainder of the standard personal-loan application fields from the matched record, which the applicant can review and edit before continuing.

This is the primary friction-reduction mechanism for the whole product: it is the reason we expect meaningfully higher completion rates than a standard long-form application.

---

## Requirement 1: Minimal-Entry Identity Capture

**User Story:** As an applicant, I want to start my application with only my phone number and a tiny piece of my name, so that I don't have to fill out a long form just to get started.

**Acceptance Criteria:**

- [ ] WHEN the applicant lands on the start screen THEN the system SHALL present exactly three inputs: mobile phone number, last name, and first initial.
- [ ] WHEN the applicant enters a phone number that does not match a valid US phone number format THEN the system SHALL show an inline error and SHALL NOT allow submission.
- [ ] WHEN the applicant submits valid values for all three fields THEN the system SHALL display a brief consent disclosure ("By continuing, you authorize us to verify your identity using your mobile carrier") before triggering the identity-match check.
- [ ] WHEN the identity-match check is in progress THEN the system SHALL show a loading state and SHALL disable the submit control to prevent duplicate requests.
- [ ] The phone number field uses `type="tel"` and formats input as `(xxx) xxx-xxxx`.
- [ ] A "Why do we need this?" expandable tooltip is accessible via keyboard and touch.

---

## Requirement 2: Identity-Match Check (Gate Before OTP)

**User Story:** As the product owner, I want the system to confirm a plausible identity match before sending any verification code, so that we don't send OTPs to unrelated numbers and so we build the pre-fill data set at the same time.

**Acceptance Criteria:**

- [ ] WHEN valid phone, last name, and first initial are submitted THEN the system SHALL call the identity-match service with exactly those three values and SHALL NOT include any other applicant data at this stage.
- [ ] WHEN the identity-match service returns a match (`summaryScore` of `high` or `medium`) THEN the system SHALL proceed to Requirement 3 (OTP send) and SHALL retain the matched profile data server-side, associated with the current session via an opaque `matchToken`, without displaying it yet.
- [ ] WHEN the identity-match service returns no match (`summaryScore` of `low` or `no_match`) THEN the system SHALL proceed to Requirement 4 (manual fallback) and SHALL NOT send an OTP.
- [ ] WHEN the identity-match service call fails or times out (network error, 5xx, timeout > 8s) THEN the system SHALL treat this the same as a no-match result and SHALL log the failure server-side without exposing technical error details to the applicant.
- [ ] WHEN more than 5 identity-match attempts are made for the same phone number within 15 minutes THEN the system SHALL reject further attempts with a rate-limit message and SHALL NOT call the underlying identity-match service.
- [ ] The endpoint SHALL never return the matched profile record to the client at this stage — only the `matchToken` and `summaryScore`.

---

## Requirement 3: OTP Delivery & Verification

**User Story:** As an applicant who has been matched, I want to receive and enter a text code, so that I can prove the phone number is mine before my information is pre-filled.

**Acceptance Criteria:**

- [ ] WHEN an identity match is found THEN the system SHALL send a one-time code to the provided phone number via the OTP provider and SHALL display a code-entry screen with a visible countdown/expiry indicator.
- [ ] WHEN the applicant enters the correct code within the validity window THEN the system SHALL mark the session as `phone_verified` and SHALL proceed to Requirement 5 (pre-fill).
- [ ] WHEN the applicant enters an incorrect code THEN the system SHALL show a clear retry message and SHALL allow up to **5 attempts** before locking the session for 5 minutes.
- [ ] WHEN the applicant requests a new code THEN the system SHALL invalidate the previous code and SHALL enforce a minimum 30-second interval between resend requests.
- [ ] WHERE the client platform supports it, the code-entry field SHALL use `autocomplete="one-time-code"` and `inputMode="numeric"` to trigger native SMS autofill on iOS/Android.
- [ ] The input SHALL accept exactly 6 digits.
- [ ] If Twilio Verify fails to deliver the SMS, the server SHALL respond with an on-screen fallback code display ("Delivery unavailable — here's your code") rather than dead-ending the applicant. This is a resilience pattern, not a cost workaround.

---

## Requirement 4: No-Match Manual Fallback

**User Story:** As an applicant whose phone/name combination could not be automatically confirmed, I want to continue my application by entering my information manually, so that a failed automated check never becomes a dead end.

**Acceptance Criteria:**

- [ ] WHEN the identity-match check returns no match THEN the system SHALL display a neutral, non-accusatory message ("We couldn't verify automatically — let's grab a couple more details") and SHALL offer a "continue manually" path. The message SHALL NOT reference or suggest that a match was attempted or failed beyond this single neutral line.
- [ ] WHEN the applicant chooses to continue manually THEN the system SHALL still require phone verification via OTP (Requirement 3) before proceeding, but SHALL collect all remaining application fields (first name, last name, DOB, address, email) through standard manual entry instead of pre-fill.
- [ ] WHEN an applicant is on the manual-entry path AND OTP verification succeeds THEN `/api/otp/verify` SHALL return `{ "verified": true, "prefill": null }` — no pre-fill data is returned.
- [ ] The fallback path SHALL merge into the same Step 3 (Confirm Info) UI as the pre-fill path — no branching UI beyond the initial neutral message.
- [ ] The fallback SHALL be reachable within 1 tap from the no-match message (no nested menus or redirects).

---

## Requirement 5: Data Pre-Fill from Matched Record

**User Story:** As a matched and phone-verified applicant, I want the rest of my application pre-filled, so that I only have to review and correct information rather than typing it from scratch.

**Acceptance Criteria:**

- [ ] WHEN phone verification succeeds AND a prior identity match exists for the session THEN the system SHALL populate: first name, last name, date of birth, mailing address (line 1, city, state, postal code), email address, and any other standard personal-loan fields available from the matched record.
- [ ] WHEN a field is pre-filled THEN the system SHALL visually indicate that it was auto-populated (a subtle "Pre-filled" tag) and SHALL keep the field editable.
- [ ] WHEN the matched record does not include a value for a given field THEN the system SHALL leave that field blank and require normal manual entry — no placeholder or guessed value.
- [ ] WHEN the applicant edits a pre-filled field THEN the system SHALL treat the edited value as authoritative for the remainder of the session (no silent overwrite back to the matched value). The "Pre-filled" tag SHALL be removed from that field.
- [ ] Address fields SHALL be broken into individual inputs (line 1, city, state, ZIP/postal code) — not a single text blob.
- [ ] The applicant must tap "Confirm" to accept the reviewed data before proceeding to the next step.

---

## Requirement 6: Rate Limiting & Abuse Prevention

**User Story:** As the product owner, I want the identity-match and OTP endpoints protected against abuse, so that the system can't be used to enumerate phone/name combinations or spam OTPs.

**Acceptance Criteria:**

- [ ] WHEN any single IP address makes more than 20 combined identity-match or OTP requests within 15 minutes THEN the system SHALL reject further requests from that IP with a generic rate-limit response.
- [ ] WHEN OTP verification fails **5 times** for a given session THEN the system SHALL lock that session's OTP step for 5 minutes, regardless of IP.
- [ ] IF an identity-match or OTP call fails THEN the system SHALL NOT include underlying provider error messages, stack traces, or internal identifiers in the applicant-facing response.
- [ ] All three identity/OTP endpoints share a single rate-limit budget per (phone, IP) pair: max 5 match attempts per phone / 15 min, max 20 combined requests per IP / 15 min.

---

## Requirement 7: Data Handling & Consent

**User Story:** As an applicant, I want to understand what happens with my phone number and name before I provide them, so that I trust the process enough to continue.

**Acceptance Criteria:**

- [ ] WHEN the applicant is on the minimal-entry screen THEN the system SHALL display a one-line explanation of why the phone number and name are needed, before the first submission.
- [ ] WHEN any PII (phone, name, DOB, address) is logged server-side THEN the system SHALL log only non-PII metadata (session ID, match result category, timestamp, attempt counts) and SHALL NOT write raw PII values to logs. The phone number SHALL be hashed before any log entry.
- [ ] Consent (session ID + timestamp) SHALL be logged server-side as proof of disclosure — no PII values in the consent log.
- [ ] WHERE the identity-match step is implemented as a mock service THEN this SHALL be explicitly documented in the README as a stand-in for a production vendor, not presented as a real carrier integration.

---

## Mock MNO Service Spec

**Important design note:** Twilio's real Identity Match product validates fields you already supply — it returns a match score per field, not new data. It does not hand back PII you didn't already have. The behavior described in Requirement 5 — phone + partial name in, a full profile out — is closer to how Prove's Pre-Fill product works. Since Prove has no public self-serve API, the mock service below is modeled as a hybrid: it uses Twilio's field-level match-scoring shape for the match step but additionally returns a fill-in profile, clearly labeled as simulated. This distinction is called out explicitly in the README.

`mock-mno-records.json` — a small fixture of fabricated "carrier records," keyed by E.164 phone number:

```json
{
  "+15555550123": {
    "firstName": "John",
    "lastName": "Smith",
    "dob": "1990-04-12",
    "addressLine1": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "email": "john.smith@example.com"
  },
  "+15555550456": {
    "firstName": "Alex",
    "lastName": "Johnson",
    "dob": "1988-03-14",
    "addressLine1": "456 Oak Ave",
    "city": "Chicago",
    "state": "IL",
    "postalCode": "60614",
    "email": "alex.johnson@example.com"
  },
  "+15555550789": {
    "firstName": "Priya",
    "lastName": "Patel",
    "dob": "1992-07-22",
    "addressLine1": "789 Elm Blvd",
    "city": "Seattle",
    "state": "WA",
    "postalCode": "98101",
    "email": "priya.patel@example.com"
  }
}
```

**Mock match scoring logic:**
1. Look up `phoneNumber` in the fixture. If not found → `{ status: "no_match", summaryScore: "no_match" }`.
2. If found, compare `lastName` (case-insensitive) and `firstNameInitial` against the record.
   - Both match → `summaryScore: "high"`
   - `lastName` matches, initial doesn't (or vice versa) → `summaryScore: "medium"`
   - Neither matches → `summaryScore: "no_match"`
3. Return `status: "matched"` for `high` or `medium`; `status: "no_match"` otherwise.
   - Medium still proceeds — documented deliberate leniency decision: in production, a real vendor's confidence thresholds would handle this. For demo, medium prevents over-rejection on a simulated source.

**Optional live-vendor stretch goal:** the same interface can be backed by a real `POST https://lookups.twilio.com/v2/PhoneNumbers/{PhoneNumber}?Fields=identity_match&...` call behind a feature flag (`USE_LIVE_IDENTITY_MATCH=true`), so swapping vendors later doesn't touch the API contract.
