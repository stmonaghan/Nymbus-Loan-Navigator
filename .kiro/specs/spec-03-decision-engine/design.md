# spec-03: Decision Engine — Design

## Decision Engine: Pure Function

```typescript
// lib/decision-engine.ts

export interface DecisionInput {
  requestedAmount: number;      // 1000–50000
  termMonths: number;           // 24, 36, 48, 60
  annualIncome: number;
  monthlyDebt: number;
  purpose: string;
}

export type DecisionOutcome = 'approved' | 'counter_offer' | 'declined';

export interface DecisionResult {
  outcome: DecisionOutcome;
  approvedAmount: number;
  apr: number;                  // e.g., 12.99
  termMonths: number;
  monthlyPayment: number;       // calculated
  totalCost: number;            // calculated
  declineReasons: DeclineReason[];
}

export type DeclineReason =
  | 'HIGH_DTI'
  | 'BELOW_MIN_INCOME'
  | 'AMOUNT_EXCEEDS_INCOME_RATIO';

// Thresholds — named constants, not magic numbers
const MIN_ANNUAL_INCOME = 18_000;
const MAX_DTI = 0.50;
const MAX_AMOUNT_INCOME_RATIO = 0.75;

const APR_TIERS = [
  { maxDti: 0.30, apr: 7.99 },
  { maxDti: 0.43, apr: 12.99 },
  { maxDti: 0.50, apr: 18.99 },
];

export function runDecisionEngine(input: DecisionInput): DecisionResult {
  const { requestedAmount, termMonths, annualIncome, monthlyDebt } = input;
  const monthlyIncome = annualIncome / 12;
  const dti = monthlyDebt / monthlyIncome;
  const declineReasons: DeclineReason[] = [];

  // Rule 1: Minimum income
  if (annualIncome < MIN_ANNUAL_INCOME) {
    declineReasons.push('BELOW_MIN_INCOME');
  }

  // Rule 2: DTI ceiling
  if (dti > MAX_DTI) {
    declineReasons.push('HIGH_DTI');
  }

  if (declineReasons.length > 0) {
    return { outcome: 'declined', approvedAmount: 0, apr: 0, termMonths, monthlyPayment: 0, totalCost: 0, declineReasons };
  }

  // Rule 3: Amount vs income ratio
  const maxAmount = annualIncome * MAX_AMOUNT_INCOME_RATIO;
  const approvedAmount = requestedAmount > maxAmount
    ? Math.floor(maxAmount / 100) * 100   // round down to nearest $100
    : requestedAmount;
  const outcome: DecisionOutcome = approvedAmount < requestedAmount ? 'counter_offer' : 'approved';

  // Rule 4: Rate assignment
  const tier = APR_TIERS.find(t => dti <= t.maxDti) ?? APR_TIERS[APR_TIERS.length - 1];
  const apr = tier.apr;

  // Amortization calculation
  const monthlyRate = apr / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? approvedAmount / termMonths
    : (approvedAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths))
      / (Math.pow(1 + monthlyRate, termMonths) - 1);
  const totalCost = monthlyPayment * termMonths;

  return {
    outcome,
    approvedAmount,
    apr,
    termMonths,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    declineReasons: [],
  };
}
```

---

## API Route: POST `/api/decision`

```typescript
// app/api/decision/route.ts

import { z } from 'zod';
import { runDecisionEngine } from '@/lib/decision-engine';

const decisionSchema = z.object({
  sessionId: z.string(),
  requestedAmount: z.number().min(1000).max(50000),
  termMonths: z.number().int().refine(v => [24, 36, 48, 60].includes(v)),
  annualIncome: z.number().min(0),
  monthlyDebt: z.number().min(0),
  purpose: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'VALIDATION_ERROR', fields: parsed.error.flatten() }, { status: 400 });
  }

  // Verify session is phone_verified before running decision
  const session = getSession(parsed.data.sessionId);
  if (!session?.phoneVerified) {
    return Response.json({ error: 'UNVERIFIED_SESSION' }, { status: 403 });
  }

  // Simulated processing delay (realistic UX)
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  const result = runDecisionEngine(parsed.data);

  // Audit log (no PII values — only outcome and session ID)
  console.log(JSON.stringify({
    event: 'decision_completed',
    sessionId: parsed.data.sessionId,
    outcome: result.outcome,
    timestamp: new Date().toISOString(),
  }));

  return Response.json(result);
}
```

---

## Decision Screen Component Design

### States

```
SUBMITTING
  → spinner + "Reviewing your application…"
  → progress animation (fake 0→100% over 2s for UX momentum)

APPROVED
  → Offer card: amount, APR, term, monthly payment, total cost
  → "Accept Offer" primary CTA
  → "Decline Offer" secondary link

COUNTER_OFFER
  → Banner: "We can offer you $X instead of $Y"
  → Same offer card as APPROVED for the counter amount
  → Same CTAs

DECLINED
  → Icon + "We're unable to approve your application at this time"
  → Decline reasons (plain-language mapping)
  → Adverse action notice block
  → "Adjust your application" CTA → goToStep(STEP_1)
```

### Decline Reason Plain-Language Map

```typescript
const DECLINE_REASON_COPY: Record<DeclineReason, string> = {
  HIGH_DTI: "Your current monthly debt payments are high relative to your income.",
  BELOW_MIN_INCOME: "Your reported income does not meet our minimum requirement.",
  AMOUNT_EXCEEDS_INCOME_RATIO: "The amount requested exceeds our limit relative to your income.",
};
```

---

## Offer Acceptance (Stub)

Tapping "Accept Offer" transitions to a `ClosingStep` component that shows:
- A placeholder e-sign document block
- Disbursement account input (routing + account number, masked)
- "Complete Application" button that simulates a final submission

This is intentionally stubbed — the PRD scopes this as out of full implementation. The stub is clearly labeled "In a production build, this step would include e-sign via DocuSign/HelloSign and ACH disbursement via Plaid."

---

## Monthly Payment Formula

Standard amortization:

```
M = P × (r(1+r)^n) / ((1+r)^n − 1)

Where:
  P = principal (approved amount)
  r = monthly rate (APR / 12 / 100)
  n = term in months
```

Displayed as: `$X.XX / month`
