# Requirements: Application Flow

## Overview

This spec defines the end-to-end application flow for **Nymbus Loan Navigator** — a loan origination and management interface that guides applicants and loan officers through the full lifecycle of a loan application, from initial inquiry through decisioning and funding.

---

## User Stories

### 1. Applicant Onboarding

**US-001** — As a prospective borrower, I want to start a new loan application so that I can request financing through the platform.

**Acceptance Criteria:**
- [ ] The user can initiate a new application from the home/dashboard screen.
- [ ] The user is prompted to select a loan product type (e.g., personal, auto, mortgage, business).
- [ ] A unique application ID is generated and displayed upon start.
- [ ] Progress is saved automatically between steps so the user can resume later.

---

### 2. Applicant Information Collection

**US-002** — As an applicant, I want to provide my personal, financial, and employment information so the lender can evaluate my request.

**Acceptance Criteria:**
- [ ] The form collects personal identity information (name, DOB, SSN/TIN, address).
- [ ] The form collects employment and income details.
- [ ] The form collects financial details (assets, liabilities, existing debts).
- [ ] All required fields are validated before the applicant can advance.
- [ ] Inline error messages appear for invalid or missing entries.
- [ ] Sensitive fields (SSN, account numbers) are masked after entry.

---

### 3. Document Upload

**US-003** — As an applicant, I want to upload supporting documents so the lender can verify my information.

**Acceptance Criteria:**
- [ ] The applicant can upload files (PDF, JPG, PNG) up to a defined size limit.
- [ ] Accepted document types include: pay stubs, bank statements, tax returns, government-issued ID.
- [ ] Uploaded documents are labeled by type and displayed in a document list.
- [ ] The applicant can remove and re-upload a document before submission.
- [ ] Upload progress is shown with a status indicator.

---

### 4. Application Review & Submission

**US-004** — As an applicant, I want to review my application before submitting it so I can correct any errors.

**Acceptance Criteria:**
- [ ] A summary screen shows all entered information and uploaded documents.
- [ ] The applicant can navigate back to any prior step to make changes.
- [ ] A consent/disclosure agreement must be accepted before submission.
- [ ] On submission, a confirmation screen displays the application ID and estimated next steps.

---

### 5. Loan Officer Review

**US-005** — As a loan officer, I want to view and evaluate submitted applications so I can make a credit decision.

**Acceptance Criteria:**
- [ ] The officer dashboard lists all pending applications with key metadata (applicant name, loan amount, date submitted, status).
- [ ] The officer can open an application to view all details and documents.
- [ ] The officer can add internal notes to an application.
- [ ] The officer can request additional information from the applicant.
- [ ] The officer can approve, decline, or counter-offer the application.

---

### 6. Decisioning & Notification

**US-006** — As an applicant, I want to be notified of the loan decision so I can take next steps.

**Acceptance Criteria:**
- [ ] The applicant receives an in-app notification and email when a decision is made.
- [ ] Approved applicants see loan terms (amount, rate, term, payment schedule).
- [ ] Declined applicants receive a reason for the decision (compliant with adverse action requirements).
- [ ] Counter-offers display revised terms and allow the applicant to accept or decline.

---

### 7. Funding & Disbursement

**US-007** — As an approved applicant, I want to complete loan closing so funds can be disbursed.

**Acceptance Criteria:**
- [ ] The applicant can e-sign closing documents within the platform.
- [ ] The applicant provides or confirms bank account details for disbursement.
- [ ] Disbursement status is shown (scheduled, in progress, completed).
- [ ] A funded confirmation screen and email are sent upon successful disbursement.

---

## Non-Functional Requirements

| ID     | Category       | Requirement                                                                 |
|--------|----------------|-----------------------------------------------------------------------------|
| NFR-01 | Security       | All data in transit must use TLS 1.2+. Sensitive fields encrypted at rest.  |
| NFR-02 | Compliance     | Adverse action notices must comply with ECOA/FCRA requirements.             |
| NFR-03 | Accessibility  | UI must meet WCAG 2.1 AA standards.                                         |
| NFR-04 | Performance    | Page transitions must complete within 2 seconds under normal load.          |
| NFR-05 | Availability   | The application flow must target 99.9% uptime during business hours.        |
| NFR-06 | Auditability   | All state transitions on an application must be logged with timestamp/actor.|
