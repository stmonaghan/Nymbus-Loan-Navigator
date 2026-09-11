# spec-01: Application Flow — Requirements

## Problem Statement

Personal loan applications have 60–90% abandonment rates. The primary driver is friction: long forms, unclear progress, redundant data entry, and distrust at verification steps. This spec defines the core multi-step wizard that makes the Nymbus Loan Navigator feel fast, trustworthy, and completable in a single mobile sitting.

## User

**Primary:** A consumer on their phone, applying for a personal installment loan in one sitting. Will abandon at the first sign of confusion, friction, or distrust.

---

## User Stories & Acceptance Criteria

### US-01 — Start an Application

**As a prospective borrower, I want to start a loan application with a single tap so I don't have to navigate a complex menu.**

- [ ] A "Get Started" CTA is visible above the fold on the landing/home screen on a 390px viewport.
- [ ] Tapping "Get Started" transitions to the first step with no full page reload.
- [ ] A unique application session ID is generated and stored in `sessionStorage` on flow entry.
- [ ] If the user returns mid-flow (same session), their last step is restored from `sessionStorage`.

---

### US-02 — See Progress at All Times

**As an applicant, I want to always know how far along I am so I don't feel like the form is endless.**

- [ ] A persistent stepper/progress bar is visible at the top of every step.
- [ ] The stepper shows step number (e.g., "Step 2 of 6"), step name, and completion state for prior steps.
- [ ] Completed steps are visually distinguished from the current and upcoming steps.
- [ ] The progress indicator updates instantly on step transition without flicker.

---

### US-03 — Step-by-Step Data Entry

**As an applicant, I want to answer one group of questions at a time so the task never feels overwhelming.**

Steps and their fields:

| Step | Name | Key Fields |
|------|------|------------|
| 1 | Loan Details | Loan amount (slider + input), loan purpose, loan term |
| 2 | Verify Identity | Phone number, last name, first initial (identity-match gate — see spec-02) |
| 3 | Confirm Your Info | Pre-filled: first name, last name, DOB, address, email (editable, spec-02) |
| 4 | Your Finances | Annual income, monthly debt payments |
| 5 | Review & Submit | Summary of all fields, consent checkbox |
| 6 | Decision | Offer / decline / refer screen (spec-03) |

- [ ] Each step fits on one screen without scrolling on a 390px device where possible.
- [ ] The "Next" / "Continue" button is always reachable without scrolling (sticky footer or visible CTA).
- [ ] Each step validates its own fields before allowing progression to the next step.
- [ ] Inline validation error messages appear on blur, not on keystroke (doesn't yell before the user finishes typing).
- [ ] On "Next", focus moves to the first field of the new step (keyboard/screen reader continuity).

---

### US-04 — Navigate Backwards Without Losing Data

**As an applicant, I want to go back and correct a previous step without losing everything I've entered.**

- [ ] A "Back" button is present on every step except Step 1.
- [ ] Navigating back restores previously entered values for that step.
- [ ] Navigating back does not re-trigger API calls (identity match, OTP) that already succeeded.
- [ ] From the Review screen (Step 5), tapping "Edit" next to a section jumps directly to that step.

---

### US-05 — Field-Level Trust Signals

**As an applicant, I want to understand why sensitive information is needed before I'm asked for it.**

- [ ] A one-line "why we need this" microcopy appears immediately above the phone/identity fields (Step 2).
- [ ] A one-line security note appears above the SSN/income fields (Step 4).
- [ ] The microcopy is dismissible and does not block the form field.

---

### US-06 — Autosave / Resume

**As an applicant, I want my progress saved automatically so a brief interruption doesn't restart me.**

- [ ] Application state is persisted to `sessionStorage` after every step completion.
- [ ] On return to the app URL within the same session, the user is offered to resume (banner or modal).
- [ ] The resume offer shows which step they left off at.
- [ ] Declining the resume offer clears state and starts fresh.

---

### US-07 — Accessible, Mobile-First Form

**As an applicant using any device or assistive technology, I want a form I can complete without barriers.**

- [ ] All form fields have associated `<label>` elements.
- [ ] All error messages are linked via `aria-describedby`.
- [ ] Numeric fields (phone, income, loan amount) trigger the numeric keyboard on mobile (`inputMode="numeric"` or `type="tel"`).
- [ ] Tap targets are at minimum 44×44px.
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).
- [ ] The stepper is navigable by keyboard and announces step changes to screen readers via `aria-live`.

---

## Out of Scope (spec-01)

- Identity verification logic (spec-02)
- Decision engine (spec-03)
- SSN field (deliberately out of scope for this take-home — documented decision: data minimization; income + DTI are sufficient inputs for the rules engine)
- Returning-user login / account creation
- Loan officer dashboard
