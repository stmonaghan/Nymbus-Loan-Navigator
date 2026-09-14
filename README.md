# Nymbus Loan Navigator

A personal loan origination flow that leverages pre-verified information from various sources to reduce the amount of manual entry required to complete an application — reducing application abandonment and driving higher visit-to-application conversion rates.

Live demo: [https://nymbus-loan-navigator.vercel.app/](https://nymbus-loan-navigator.vercel.app/)

---

## Background

Loan applications — especially unsecured personal loans — have some of the highest abandonment rates in consumer finance. The guiding question for this build was: *what's actually driving that abandonment, and what's the highest-leverage fix?*

- Personal loan applications complete at roughly **42%**, which is among the higher abandonment rates of any consumer lending product ([Lorikeet](https://lorikeetcx.ai/articles/recover-abandoned-loan-applications-ai)). One regional bank case study found a **67% personal-loan abandonment rate translating to roughly $100 million in lost annual interest income** ([Banking on Digital Growth](https://podcast.ausha.co/banking-on-digital-growth/438-the-100-million-problem-calculating-the-financial-impact-of-abandoned-applications)).
- The problem is also getting worse, not better: **68% of consumers abandoned an online financial-services application in the past year, up from 63% just two years earlier** ([Signicat's "Battle to Onboard" research](https://www.kommunicate.io/blog/loan-application-abandonment/)) — despite continued investment in digital onboarding technology across the industry.
- Research into personal-loan abandonment consistently points to **time spent manually entering information** as one of the leading causes — long forms, redundant data entry, and re-typing information the lender could plausibly already access all compound into drop-off before a decision is ever reached.
- Based on that, the core hypothesis behind this build is: **pre-filling as much of the application as possible, immediately after verifying the applicant's identity, is the single biggest differentiator from a traditional loan application workflow** — more impactful than the design of the UI, offering additional loan products, or other application workflow features.
- The application looks to pre-verify applicant PII, and once identity is confirmed utilizing cell phone carrier MNO data, present back the applicant's personal information pre-filled for a quick review and progression on to the next phase.

That hypothesis is what the entire identity-match-and-verification flow is built around: collect the absolute minimum amount of information possible (phone number, last name, first initial), verify it with the applicant via a combination of MNO data from cell phone carriers/verification services (such as Prove), and once input data is matched to the records on file with the verification service, send an OTP to the applicant to enter the code. Once the OTP is provided accurately, the confidence now exists to pre-fill all personal information on file with the verification service, since this would require the applicant to have both the personal info required to make the match, as well as the device linked to them with the verification service provider. Doing so in this way allows for protection against fraud while also eliminating as much manual data entry as possible.

In addition to the pre-filling of personal information, additional opportunities for pre-verification of income, address, and identity would further streamline the workflow and provide both confidence in the reduction of fraud while streamlining the workflow to optimize conversion rates. These features were not built in the initial build for the sake of time, but would be key features built in future phases to support the application in achieving its goal of reducing application abandonment as much as possible.

---

## Process & Approach

Rather than jumping right to solutioning, the process was to first do research to validate the hypothesis with data, then develop a product feature map to address the pain points in traditional application flows. Next, the objective was to leverage AI to map out the build and iterate through versions to arrive at the current state given the time constraints. The steps taken are detailed below:

1. **Research the leading reasons for app abandonment in the personal loan space** — before designing anything, the first step was understanding why applicants actually drop off, rather than assuming.
2. **Convert that research into a concrete product recommendation** — turning "manual data entry is the top friction point" into an actual, buildable approach: verify identity first, then pre-fill everything that verification makes possible.
3. **Translate the recommendation into a feature list and roadmap** — breaking the verification and pre-fill concept down into a prioritized, sequenced set of features (minimal-entry identity capture, gated OTP verification, no-match fallback, pre-fill, loan details, decisioning) directly mapped to the abandonment pain points identified in research, rather than building features in an arbitrary order. This became the basis for the phased spec structure under `.kiro/specs/`.
4. **Build, then test to find and fix bugs before the security pass** — running the automated test suite and manual click-throughs after each phase to surface functional issues (e.g., the OTP session-persistence bug that only appeared under real serverless deployment) and address them first, so the subsequent security review is checking a working, stable system rather than chasing bugs and vulnerabilities at the same time.
5. **Review the code for security gaps** — an explicit pass, done only once the functional issues above were resolved, checking for issues like PII exposure in logs, session/token handling, and rate-limiting coverage.
6. **Review and refactor for efficiency and responsiveness** — a pass aimed at code quality and system responsiveness, not just feature completeness, given the requirement to ensure high responsiveness at scale.
7. **Enhance the UI/UX for conversion, not just usability** — a dedicated pass to make the application look and feel modern and trustworthy, not merely functional, since visual trust signals (clean design, clear progress status, a professional look) directly affect an applicant's willingness to complete an application and confirm/edit sensitive information. The aim was to address the same abandonment problem this project set out to solve, but from the UI design side as well.

---

## What's Built

A single-borrower, personal installment loan origination flow through a mock soft pull and offer selection stage:

1. **Minimal-entry identity capture** — phone number, last name, first initial. Three fields, one screen.
2. **Identity-match check** — gates whether an OTP is even sent, backed by a mocked MNO-record data source (see *Vendors & APIs* below for why this is mocked rather than live).
3. **Real SMS 2FA via Twilio Verify** — a genuine, working integration on an upgraded Twilio account, not a simulated stand-in.
4. **No-match manual fallback** — anyone who doesn't match (prepaid line, ported number, family-plan account) can still complete the application by hand rather than hitting a dead end. This path still requires OTP phone verification.
5. **Automatic pre-fill** — on a successful match and OTP verification, first name, last name, DOB, address, and email are pulled from the matched record and shown as editable, clearly-labeled pre-filled fields.
6. **A confirm/review screen** for the applicant to check and correct their pre-filled information.
7. **A loan application form** — requested amount, requested loan term, annual income, loan purpose.
8. **A rules-based decision engine** — a pure, independently-tested function that returns Approved, Referred for review, or Declined based on income-to-requested-amount ratio, with the ability to Select or Update as desired.
9. **An offer/result screen** reflecting the outcome, with the ability to Select an offer or Update the loan details and resubmit.
10. **A Tailwind-based visual design pass** across all of the above to ensure a modern, professional, and trustworthy UI design.

---

## Vendors & APIs — What's Real, What's Mocked, and Why

| Component | Approach | Why |
|---|---|---|
| **SMS 2FA / OTP delivery** | **Real** — Twilio Verify, upgraded (billing-enabled) account | Twilio Verify handles OTP generation, expiry, rate-limiting, and brute-force protection server-side — a stronger security posture than a hand-rolled OTP. Twilio's no-card trial no longer covers Verify Service creation (a response to SMS-pumping fraud that specifically targeted Verify), so the account was upgraded deliberately. |
| **Identity match** (phone + partial name → matched record) | **Mocked** — a small, self-controlled JSON fixture of fabricated "carrier records" | Real phone-to-identity matching against carrier (MNO) data is licensed, compliance-gated data — there is no free, self-serve vendor for it. The two real players are **Twilio Lookup — Identity Match** (validates fields you already provide; doesn't return new PII) and **Prove (Prove Pre-Fill)** — the actual industry incumbent for this exact "phone → verify → pre-fill" pattern, but it's enterprise/sales-led only with no public API key, so it isn't accessible for a self-serve build. The mock is also arguably more correct for a demo: you can't ethically test real carrier matching against fabricated take-home test applicants anyway. |
| **Credit decisioning** | **Mocked** — a simple, transparent income-to-loan-amount ratio | A real bureau pull (Experian/Equifax/TransUnion) requires paid contracts and compliance infrastructure out of scope for a take-home. The decision logic is a pure function, independently unit-tested, and designed to be swapped for a real bureau-backed engine without changing its interface. |

---

## How to Run Locally

1. **Install Node.js** (LTS) from [nodejs.org](https://nodejs.org) if not already installed.
2. **Clone the repo**, then from the project root:
   ```
   npm install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`.
   - Fill in real values for `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, and `SESSION_SECRET` (generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) from your own Twilio Console (Verify → Services).
4. **Start the dev server:**
   ```
   npm run dev
   ```
5. Open `http://localhost:3000` in a browser.
6. **To test the identity-match success path**, use one of the fictional test identities below (from `lib/mock-mno-records.json`) — enter the phone number, last name, and first initial exactly as shown:

   | Phone Number | Last Name | First Initial |
   |---|---|---|
   | `(555) 555-0123` | Smith | J |
   | `(555) 555-0456` | Johnson | A |
   | `(555) 555-0789` | Patel | P |

   Any other phone/name combination will correctly route to the no-match manual-entry fallback — that path still requires real OTP verification via your own Twilio account, so you'll need to verify your own test number in the Twilio Console (Phone Numbers → Verified Caller IDs) to actually receive a code.
7. **Passing the OTP step for the three fictional test numbers above:** since `555-555-xxxx` numbers aren't real, dialable phone numbers, Twilio has nothing to actually deliver a text to. For exactly these three fictional identities, enter **`000000`** at the OTP step — this is a hardcoded test-bypass code (`TEST_PHONE_NUMBERS` in `app/api/identity/verify-otp/route.ts`) that only works for these three fictional numbers, so the full identity-match → pre-fill → loan → decision flow can be demoed end-to-end without needing a real, Twilio-verified phone number on hand. Any real phone number you add yourself (see the note below) still requires the actual code Twilio texts you — the bypass never applies to real numbers.
8. **Testing with a real phone number (optional):** to test with a real, texted OTP rather than the bypass code, copy `lib/mock-mno-records.local.example.json` to `lib/mock-mno-records.local.json` (already excluded from git) and add your own entry, keyed by E.164 phone number. Restart the dev server afterward — the overlay is read at startup. See *Vendors & APIs* above for why this stays out of the committed fixture.
9. **Run tests:**
   ```
   npm test
   ```

---

## Live Demo (No Setup Required)

For reviewing the working application without installing Node, cloning the repo, or configuring any environment variables, use the live deployment instead:

**[https://nymbus-loan-navigator.vercel.app/](https://nymbus-loan-navigator.vercel.app/)**

A few things worth knowing about the hosted version:

- It's deployed via **Vercel**, connected directly to this repo's `main` branch — every push to `main` automatically triggers a new production deployment, so the live link always reflects the latest committed code.
- It runs against the **same real Twilio Verify integration** as the local version (not a simulated stand-in), using credentials stored securely as Vercel environment variables rather than in the codebase — so testing the OTP step here sends a genuine SMS, the same as it would locally.
- **To test the pre-fill success path**, enter one of these fictional identities on the start screen:

  | Phone Number | Last Name | First Initial |
  |---|---|---|
  | `(555) 555-0123` | Smith | J |
  | `(555) 555-0456` | Johnson | A |
  | `(555) 555-0789` | Patel | P |

  Any other phone/name combination will correctly route to the no-match manual-entry fallback instead.
- **At the OTP step, enter `000000`.** These fictional numbers can't receive a real text (they're not real, dialable phone numbers), so a hardcoded test-bypass code is scoped specifically to these three fixture identities. This is documented in more detail, along with the security reasoning behind it, under *How to Run Locally* and *Key Decisions* below.
- Because it's a genuine serverless deployment rather than a single long-running process, this is also the version that surfaced (and validated the fix for) a real production-only bug during development — see *Key Decisions* below for the OTP session-persistence issue that only appeared once deployed here, not locally.

---

## Kiro Spec-Driven Workflow

Specs live under `.kiro/specs/` within the project. Below details how they are organized:

- **`spec-01-application-flow`** — labeled **Superseded** at the top of each file. It captures Kiro's initial, broader proposed design: a Zustand-based state machine with a separate `/apply` route and a dedicated `StepIndicator` component. Given the take-home time box, this was deliberately scoped down and implemented directly with the agent instead, using simpler plain-React-state architecture. The original spec is kept, not deleted, as an honest record of that scoping decision — not as a reflection of what was actually built.
- **`spec-02-identity-match-and-verification`** — the fully accurate, fully-executed spec. This is where spec-driven rigor was deliberately concentrated: it was the highest-complexity, highest-risk piece of the build (a real third-party vendor integration, a security-sensitive OTP flow, rate limiting, a genuinely novel UX pattern), and it earned the cost of writing requirements, design, and tasks before touching code.
- **`spec-03-decision-engine`** — also labeled **Superseded**. It captures a more elaborate initial design (an API-backed decision engine with counter-offers, adverse-action notices, and a full e-sign closing flow) than what was actually built. Given the time box, a leaner rules-based version was implemented directly instead (see `lib/loan-decision.ts`). Kept for the same reason as spec-01 — an honest record of the scoping decision, not the actual implementation.

Two other stray/incomplete spec artifacts from an early, over-broad first pass at the full game plan were removed entirely rather than labeled, since nothing was ever built against them.

One spec was built complete, while the other two are superseded scope-downs. This was a result of the time constraints of the initial project and the level of effort required to achieve them fully. The full scope of these specs would be built in future phases as time permits.

---

## AI Collaboration Log

`docs/ai-collaboration-log.md`, captured via a Kiro agent hook (`.kiro/hooks/log-ai-collaboration.json`, `Stop` trigger).

The first log hook was set up early in the project but used an incorrect trigger schema (borrowed from a different tool's hook vocabulary) and never actually fired — this wasn't caught until later in the build, so the log contains zero live-captured entries for a meaningful stretch of the work. Once identified, the hook was rebuilt using Kiro's real agent-hook system, verified to fire correctly and reliably, and a retroactive summary entry was added to reconstruct what happened before the fix — explicitly labeled as a manual reconstruction (with a date-only stamp) rather than presented as if it had been live-captured. That retroactive entry's file references were then independently verified against the actual repo rather than left as unverified claims. Every entry from the fix onward is a genuine, automatically-captured, real-time log entry.

---

## Key Decisions

- **Pre-fill after verification, not before** — the entire product bet: verify identity with minimal data entry, validate device possession tying back to verification of identity to pre-fill personal information. Continue to eliminate as much manual entry as possible for everything thereafter.
- **Mock the identity-match data source, use a real vendor for OTP** — a deliberate split: OTP delivery is genuinely production-grade (Twilio Verify), while identity-match data is honestly mocked because no free, ethical, real alternative exists for a take-home.
- **Upgrade the Twilio account rather than simulate SMS delivery** — to give a sense of how this could truly work on a real device, a real integration was chosen over a free stand-in.
- **Single-product depth over multi-product breadth** — one loan type, fully working, rather than a shallow multi-product shell. Given the time constraints, this was the only feasible path as well.
- **Label superseded specs rather than delete or pretend they're current** — an honest paper trail of scoping decisions made along the way. Adjustments needed to be made to the scope based on level of effort and time constraints to complete the exercise.
- **Diagnosed and fixed a serverless state bug post-deploy** — the OTP session store initially used in-process memory, which worked locally but failed on the live Vercel deployment because separate serverless invocations don't share memory. Replaced it with a stateless, HMAC-signed token passed to and from the client, avoiding the need for external infrastructure (Redis/KV) since the actual OTP code itself was never stored server-side to begin with (Twilio Verify owns that).
- **Opted to extend beyond the free version of ChatGPT and Kiro** to ensure the scope of the product could be increased to something meaningful. The original scope was pared back significantly due to the amount of credits available on free accounts for both platforms, but upgrading to paid versions allowed for a more meaningful Phase 1 build.

---

## Enhancements Given More Time

- **Enhanced UI** — the current Tailwind pass covers consistency and responsiveness; a production build would go further on visual polish, brand identity, and micro-interactions.
- **Security review** — a dedicated pass to review the codebase for security gaps beyond what was addressed incrementally during the build (rate limiting, PII logging discipline, session handling).
- **Connecting identity verification to a real TU/MNO data service** — replacing the mocked identity-match fixture with a live data service such as Prove for real data pre-population, rather than mock records.
- **A real credit bureau pull and decision engine** — replacing the rules-based income/amount-ratio logic with an actual bureau-backed underwriting engine (Experian/Equifax/TransUnion), while preserving the existing `DecisionResult` interface so the swap doesn't require touching the UI.
- **A built-out verification / signing flow** — document upload (ID, proof of income, proof of address) with real OCR/ID-verification vendor integration (e.g., Prove, Persona, Onfido), plus the e-signature step needed to actually close a loan — rather than the scope cut made during this build.
- **Additional functionality**: adverse-action (AA) reason generation for declined applicants, and a full closing/e-sign flow for approved applicants — both scoped out of `spec-03` when it was superseded in favor of a leaner build.
- **AI-collaboration hook reliability** — the initial hook was prompted for early in the project but wasn't actually set up correctly (it used a different tool's trigger schema and never fired) until the issue was identified in the latter half of the build. Once found, the hook was properly established, and a manual recollection/reconstruction was attempted to remediate the missing log contents for the period before the fix — explicitly labeled as such rather than presented as live-captured data. With more time, this would be caught and fixed at initial setup rather than mid-build.
- **A dedicated efficiency/responsiveness refactor pass** — reviewing the codebase for opportunities to improve performance and system responsiveness at scale, beyond what was addressed opportunistically during feature development.
- **A/B test capability** — infrastructure to run controlled experiments on flow variants (e.g., field ordering, copy, the pre-fill confirmation step) to validate the abandonment-reduction hypothesis with real data rather than research alone. An example would be to A/B test the impact to application completion rates of presenting the last 4 digits of SSN pre-verified for confirmation/ability to edit, to increase potential accuracy on soft bureau pulls for very common names.
- **An analytics platform** — funnel and drop-off tracking across each step of the application (minimal-entry capture, identity match, OTP, pre-fill review, loan details, decision) to measure completion rate improvements against the original abandonment problem this project set out to solve, and to give the A/B tests above something to measure against.
- **Ability to track applicant behavior** — leverage a tool such as GlassBox to see and understand how potential applicants are interacting with the page, to further refine the strategy and workflow as a result.
- **Frictionless income verification via Powerlytics/The Work Number/Plaid** — using Powerlytics for an initial income estimate without requiring the applicant to connect any accounts, then waterfalling to a direct-verification source (Plaid or The Work Number) only when Powerlytics' confidence score is too low to rely on alone. This keeps the low-friction, pre-fill-first philosophy of the rest of the application intact for the common case, while still allowing a harder verification when the data warrants it.
- **More time on branding and UI** — visual identity and UI polish were intentionally deprioritized in favor of the core identity-match/pre-fill mechanics given the time box; "Nymbus Loan Navigator" was chosen as the product name specifically to demonstrate strategic, brand-level thinking from a marketing standpoint even where full visual execution wasn't the priority.
