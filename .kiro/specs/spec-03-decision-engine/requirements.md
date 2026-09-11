# spec-03: Decision Engine — Requirements

## Overview

After the applicant submits their application (Step 5), the system runs a rules-based underwriting engine and returns an instant decision: **Approved with offer**, **Counter-offer** (approved for a different amount), or **Declined**. The decision is transparent, immediate, and shown on-screen — never a silent redirect or "we'll email you."

**Design decision:** The engine is a pure function of the application inputs — no side effects until the final "accept offer" commit. This makes it independently testable and trivially swappable for a real bureau-pull engine later.

---

## User Stories & Acceptance Criteria

### US-14 — Instant Decision

**As an applicant, I want to see a decision immediately after submitting so I'm not left wondering.**

- [ ] After the applicant taps "Submit Application" on the Review screen, the UI shows a loading state ("Reviewing your application…") for 1.5–2.5 seconds (simulated processing time for UX realism).
- [ ] The Decision screen is shown within 3 seconds of submission on a normal connection.
- [ ] Three possible outcomes are handled: `approved`, `counter_offer`, `declined`.
- [ ] There is no "pending" or "we'll email you" outcome — every path has an immediate screen.

---

### US-15 — Approved Offer Screen

**As an approved applicant, I want to see my loan terms clearly so I can make an informed decision.**

- [ ] The offer screen displays: approved amount, interest rate (APR), term, estimated monthly payment, and total cost of credit.
- [ ] Monthly payment is calculated client-side from the returned terms using the standard amortization formula.
- [ ] An "Accept Offer" CTA and a "Decline Offer" option are both clearly visible.
- [ ] Tapping "Accept Offer" advances to a confirmation/e-sign placeholder screen.
- [ ] Tapping "Decline Offer" shows a brief "Thanks for applying" screen with a option to restart.

---

### US-16 — Counter-Offer Screen

**As an applicant who qualifies for a different amount than requested, I want to see the counter-offer terms and choose to accept or decline.**

- [ ] The counter-offer screen clearly states both the requested amount and the approved amount.
- [ ] All terms (rate, monthly payment, total cost) are shown for the counter-offered amount.
- [ ] The same Accept / Decline CTAs are shown as in the approved flow.

---

### US-17 — Decline Screen

**As a declined applicant, I want a clear, respectful explanation so I'm not confused about what happened.**

- [ ] The decline screen shows 1–3 plain-language decline reasons (drawn from the rules engine output).
- [ ] The screen includes an adverse-action notice placeholder ("You have the right to request a free credit report…").
- [ ] A "Check Your Rate Again" CTA allows the applicant to adjust their requested amount and re-submit (loops back to Step 1 with preserved financial data).

---

### US-18 — Decision Endpoint

**As the system, I need a rules-based decision endpoint that deterministically evaluates an application.**

- [ ] POST `/api/decision` accepts the full application payload.
- [ ] The endpoint validates the payload with Zod before running the engine.
- [ ] The endpoint returns a `DecisionResult` within 500ms (pure computation, no I/O).
- [ ] The rules are documented in the design doc — no magic numbers in the code.

---

## Decision Rules (Documented, Not Magic)

| Rule | Condition | Outcome |
|------|-----------|---------|
| DTI check | `monthlyDebt / (annualIncome/12) > 0.50` | Decline: `HIGH_DTI` |
| Minimum income | `annualIncome < 18000` | Decline: `BELOW_MIN_INCOME` |
| Amount vs income | `requestedAmount > annualIncome * 0.75` | Counter-offer: `AMOUNT_EXCEEDS_INCOME_RATIO` — max approved = `annualIncome * 0.75` |
| Rate assignment | DTI 0–0.30 → 7.99% APR; 0.31–0.43 → 12.99% APR; 0.44–0.50 → 18.99% APR | Approved |
| Default | All above pass | Approved at requested amount |

**Decision log:** These thresholds are illustrative stand-ins for a real bureau-pull engine. In production, this function is replaced by an Experian/Plaid call. The interface contract (`DecisionResult`) does not change.
