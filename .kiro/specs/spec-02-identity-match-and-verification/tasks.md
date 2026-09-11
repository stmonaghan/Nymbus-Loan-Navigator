# spec-02: Identity Match & Verification — Tasks

---

- [x] **Task 1** — Create `lib/mno-mock.ts`: the controlled fixture MNO record store. Export `matchIdentity(phone, lastName, firstInitial): MNORecord | null`.

- [x] **Task 2** — Create `lib/twilio.ts`: `sendOtp(phone)` and `checkOtp(phone, code)` wrappers with try/catch. Return `null`/`false` on failure (never throw to the route handler).

- [x] **Task 3** — Create `lib/session-cache.ts`: in-memory session store with TTL, attempt counter, lock logic, and resend counter.

- [x] **Task 4** — Create `lib/rate-limit.ts`: per-(phone, IP) rate limiter (max 5 match attempts / 15 min). Reusable across all three identity endpoints.

- [x] **Task 5** — Create `app/api/identity/match/route.ts`: validate input → rate-limit check → run match (mock or live) → if matched, send OTP, cache record → return response.

- [x] **Task 6** — Create `app/api/identity/verify-otp/route.ts`: check lock → call Twilio check (or mock approval for test numbers) → on success, return prefill data → on failure, increment counter.

- [x] **Task 7** — Create `app/api/identity/resend-otp/route.ts`: check resend count → call `sendOtp` → increment counter.

- [x] **Task 8** — Build `components/steps/IdentityStep.tsx` (Step 2): phone/lastName/firstInitial form, consent disclosure, client-side validation, POST to `/api/identity/match`, loading state, transitions to OTP screen or fallback.

- [x] **Task 9** — Build `components/steps/OtpStep.tsx`: 6-digit input with `autocomplete="one-time-code"`, verify CTA, POST to `/api/identity/verify-otp`, error/lock/countdown states, resend link with 30s timer.

- [x] **Task 10** — Build `components/steps/FallbackIdentityStep.tsx`: manual entry form (firstName, lastName, DOB, address, email). Merges into same confirmed-info shape as the pre-fill path.

- [x] **Task 11** — Build `components/steps/ConfirmInfoStep.tsx` (Step 3): display pre-filled or manually entered fields, editable inputs, "Pre-filled" badge component, Confirm CTA.

- [x] **Task 12** — Wire all identity steps into `StepWizard.tsx`. Test the full match → OTP → prefill path and the no-match → fallback path end-to-end.
