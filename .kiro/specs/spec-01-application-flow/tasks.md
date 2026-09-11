# spec-01: Application Flow — Tasks

Each task is independently completable. The app is demoable after Task 4.

---

- [ ] **Task 1** — Scaffold Next.js 14 app with TypeScript, Tailwind CSS, Zustand, Zod, and React Hook Form. Configure `tailwind.config.ts` with the Nymbus design tokens (color palette, font). Add `.env.example`.

- [ ] **Task 2** — Create `types/application.ts` with all shared TypeScript interfaces (`LoanDetailsData`, `IdentityData`, `PersonalInfoData`, `FinancesData`, `DecisionResult`, `StepId` enum).

- [ ] **Task 3** — Create `store/applicationStore.ts` (Zustand). Implement step navigation (`nextStep`, `prevStep`, `goToStep`), field setters, `persistToStorage`, `hydrateFromStorage`, and `resetApplication`.

- [ ] **Task 4** — Create `components/wizard/StepWizard.tsx` and `StepLayout.tsx`. Wire step rendering to the store's `currentStep`. Add sticky footer with Back/Next buttons. App is now navigable (empty steps).

- [ ] **Task 5** — Create `components/wizard/StepIndicator.tsx`. Render completed/active/locked states. Add `aria-current`, `aria-live` region, and keyboard focus management on step change.

- [ ] **Task 6** — Create shared UI components: `Button.tsx`, `Input.tsx`, `FieldError.tsx`, `TrustBadge.tsx`, `LoadingSpinner.tsx`, `Slider.tsx`.

- [ ] **Task 7** — Build `LoanDetailsStep.tsx` (Step 1): loan amount slider + numeric input, purpose select, term select. Wire Zod validation via React Hook Form. Inline errors on blur.

- [ ] **Task 8** — Build `FinancesStep.tsx` (Step 4): annual income input, monthly debt input. Wire Zod validation. Trust microcopy above income field.

- [ ] **Task 9** — Build `ReviewStep.tsx` (Step 5): read-only summary of all store values. "Edit" links that call `goToStep`. Consent checkbox. Submit button triggers decision flow (stubbed with loading state for now).

- [ ] **Task 10** — Build `app/apply/page.tsx` as the SPA host: hydrate store from `sessionStorage` on mount, show resume banner if prior session detected, render `<StepWizard>`.

- [ ] **Task 11** — Build `app/page.tsx` landing page: hero section, product summary, "Get Started" CTA that navigates to `/apply`. Mobile-first layout.

- [ ] **Task 12** — Add `Header.tsx` with Nymbus brand logo and "Secured by 256-bit SSL" trust badge. Add minimal `Footer.tsx`.

- [ ] **Task 13** — Responsive pass for all spec-01 components: verify 390px, 768px, 1280px breakpoints. Ensure tap targets ≥ 44px. Numeric keyboard triggers on relevant inputs.
