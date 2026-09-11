# spec-01: Application Flow — Design

## Architecture Decision: SPA Wizard on a Single Route

The entire application flow lives at `/apply`. State is managed client-side via a `useApplicationStore` Zustand store. There are no full navigations between steps — the stepper is a React state machine that renders the active step component. This means:
- No URL-per-step (eliminates accidental back-button exits mid-flow)
- No full reloads (zero blank-screen flicker on step transition)
- `sessionStorage` provides persistence across tab close/reopen within the same session

**Decision log:** Single-route SPA over multi-page routing. Rationale: higher completion rate, simpler state management, matches mobile app feel. Trade-off: direct deep-links to steps are not supported (acceptable for a single-session flow).

---

## Application State Machine

```
IDLE
  └─(start)──► STEP_1_LOAN_DETAILS
                  └─(next, valid)──► STEP_2_IDENTITY
                                        └─(match + OTP success)──► STEP_3_CONFIRM_INFO
                                        └─(no-match)─────────────► STEP_3_MANUAL_ENTRY (spec-02)
                                              └─(next, valid)──► STEP_4_FINANCES
                                                                      └─(next, valid)──► STEP_5_REVIEW
                                                                                              └─(submit)──► STEP_6_DECISION
                                                                                                                 └─(offer/decline/refer)──► COMPLETE
```

Any step can transition `back` to the prior step without re-running API calls (identity match / OTP already committed to store).

---

## Component Hierarchy

```
src/
├── app/
│   ├── page.tsx                    ← Landing page (hero + CTA)
│   ├── apply/
│   │   └── page.tsx                ← SPA wizard host
│   └── layout.tsx                  ← Root layout (font, global styles)
├── components/
│   ├── wizard/
│   │   ├── StepWizard.tsx          ← Orchestrator: renders active step, prev/next
│   │   ├── StepIndicator.tsx       ← Top progress bar + step names
│   │   └── StepLayout.tsx          ← Consistent padding, sticky footer CTA
│   ├── steps/
│   │   ├── LoanDetailsStep.tsx     ← Step 1
│   │   ├── IdentityStep.tsx        ← Step 2
│   │   ├── ConfirmInfoStep.tsx     ← Step 3
│   │   ├── FinancesStep.tsx        ← Step 4
│   │   ├── ReviewStep.tsx          ← Step 5
│   │   └── DecisionStep.tsx        ← Step 6
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Slider.tsx
│   │   ├── Select.tsx
│   │   ├── FieldError.tsx
│   │   ├── TrustBadge.tsx          ← "Why we need this" microcopy
│   │   └── LoadingSpinner.tsx
│   └── layout/
│       ├── Header.tsx              ← Brand logo + "Secure application" badge
│       └── Footer.tsx
├── store/
│   └── applicationStore.ts         ← Zustand store
├── lib/
│   ├── validation.ts               ← Zod schemas per step
│   └── api.ts                      ← Typed fetch wrappers
└── types/
    └── application.ts              ← Shared TypeScript interfaces
```

---

## Zustand Store Shape

```typescript
interface ApplicationStore {
  // Step navigation
  currentStep: StepId;
  completedSteps: Set<StepId>;
  goToStep: (step: StepId) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Application data
  sessionId: string;
  loanDetails: LoanDetailsData;
  identity: IdentityData;          // populated in spec-02
  confirmedInfo: PersonalInfoData; // populated in spec-02
  finances: FinancesData;
  decision: DecisionResult | null; // populated in spec-03

  // Verification state (spec-02)
  phoneVerified: boolean;
  identityMatchResult: 'matched' | 'no_match' | 'pending' | null;

  // Persistence
  hydrateFromStorage: () => void;
  persistToStorage: () => void;
  resetApplication: () => void;
}
```

---

## Step Validation Schemas (Zod)

```typescript
// Step 1 — Loan Details
const loanDetailsSchema = z.object({
  amount: z.number().min(1000, 'Minimum loan is $1,000').max(50000, 'Maximum loan is $50,000'),
  purpose: z.enum(['debt_consolidation', 'home_improvement', 'medical', 'auto', 'vacation', 'other']),
  termMonths: z.enum(['24', '36', '48', '60']),
});

// Step 4 — Finances
const financesSchema = z.object({
  annualIncome: z.number().min(12000, 'Annual income must be at least $12,000'),
  monthlyDebt: z.number().min(0),
});

// Step 5 — Review (consent only)
const reviewSchema = z.object({
  consentGiven: z.literal(true, { errorMap: () => ({ message: 'You must agree to continue' }) }),
});
```

---

## StepIndicator Design

```
[ ① Loan ] —— [ ② Verify ] —— [ ③ Info ] —— [ ④ Finances ] —— [ ⑤ Review ] —— [ ⑥ Decision ]
  done          active          locked           locked             locked           locked
```

- Completed steps: filled circle, checkmark icon
- Active step: filled circle, accent color, `aria-current="step"`
- Locked steps: outline circle, muted color
- Step names are truncated with ellipsis below 480px; only the icon shows below 360px
- `aria-label` on each step includes full name regardless of truncation

---

## SessionStorage Schema

```json
{
  "nymbus_app_v1": {
    "sessionId": "abc123",
    "currentStep": 3,
    "completedSteps": [1, 2],
    "loanDetails": { "amount": 10000, "purpose": "debt_consolidation", "termMonths": "36" },
    "identity": { "phone": "***", "lastName": "***", "firstInitial": "***" },
    "phoneVerified": true,
    "identityMatchResult": "matched",
    "confirmedInfo": { ... },
    "finances": { ... }
  }
}
```

PII in sessionStorage is limited to what's needed to restore UI state. Phone number is stored; full SSN is never stored client-side.

---

## Error Handling

| Scenario | UI Response |
|----------|-------------|
| Step validation fails | Inline field errors on blur; "Next" button disabled while invalid |
| `sessionStorage` unavailable | Flow works without persistence; resume offer simply not shown |
| API call fails (spec-02/03) | Handled in those specs; this spec owns the form-level errors only |

---

## Accessibility Implementation Notes

- `<form>` per step, with `onSubmit` wired to "Next" so Enter key advances the step
- `aria-live="polite"` region below stepper announces step name changes
- On step transition: `focus()` called on the step's `<h2>` heading (tabIndex=-1)
- `aria-describedby` on every input points to its `<FieldError>` element (rendered even when empty, with `aria-hidden="true"` when no error)
- Loan amount slider has `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (formatted as currency)
