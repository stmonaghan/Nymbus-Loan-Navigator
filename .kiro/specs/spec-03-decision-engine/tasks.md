> **Status: Superseded.** This spec captured an initial, broader design (API-backed decision engine, counter-offers, adverse-action notices, e-sign closing flow). Given the take-home time box, I made a deliberate call to implement a leaner, fully-working version directly instead — see `lib/loan-decision.ts`, `components/loan/LoanApplicationForm.tsx`, and `components/loan/LoanOfferScreen.tsx`. This file is kept as a record of that scope decision, not as a reflection of what was built.
# spec-03: Decision Engine — Tasks

---

- [ ] **Task 1** — Create `lib/decision-engine.ts`: pure `runDecisionEngine` function with named constants, all four rules, amortization calculation. Export `DecisionInput`, `DecisionResult`, `DeclineReason` types.

- [ ] **Task 2** — Create `app/api/decision/route.ts`: Zod validation → session verification → 1.5–2.5s simulated delay → `runDecisionEngine` → structured audit log → return result.

- [ ] **Task 3** — Build `components/steps/DecisionStep.tsx`: three sub-states (submitting, result-received). On mount, POST to `/api/decision` with store data. Handle loading, success, error.

- [ ] **Task 4** — Build `components/decision/OfferCard.tsx`: display approved amount, APR, term, monthly payment, total cost. Accept/Decline CTAs.

- [ ] **Task 5** — Build `components/decision/CounterOfferBanner.tsx`: "We can offer $X instead of $Y" banner, shown above OfferCard when outcome is `counter_offer`.

- [ ] **Task 6** — Build `components/decision/DeclineScreen.tsx`: decline icon, plain-language reasons list, adverse action notice block, "Adjust your application" CTA that calls `goToStep(STEP_1_LOAN_DETAILS)` with preserved financial data.

- [ ] **Task 7** — Build `components/decision/ClosingStep.tsx`: stub e-sign block, disbursement account inputs (masked), "Complete Application" button with final confirmation screen.

- [ ] **Task 8** — Wire `DecisionStep` into `StepWizard`. Test all three outcome paths: approved, counter_offer, declined. Verify the "Adjust" path loops back to Step 1 with data intact.


