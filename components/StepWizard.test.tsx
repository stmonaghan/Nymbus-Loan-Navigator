/**
 * StepWizard.test.tsx
 *
 * End-to-end wiring tests for StepWizard.
 * Sub-components are mocked — these tests verify only the state-machine
 * transitions (which step renders, what data is passed between steps).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepWizard } from './StepWizard';

// ─────────────────────────────────────────────
// Mock sub-components
// Each mock renders a button that fires the relevant callback with test data.
// ─────────────────────────────────────────────

const TEST_PHONE = '+15555550123';

const TEST_PREFILL = {
  firstName: 'John',
  lastName: 'Smith',
  dob: '1990-04-12',
  addressLine1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  email: 'john.smith@example.com',
};

const TEST_CONFIRMED_INFO = {
  ...TEST_PREFILL,
  source: 'manual' as const,
};

vi.mock('./steps/IdentityStep', () => ({
  IdentityStep: ({
    onMatchSuccess,
    onNoMatch,
  }: {
    onMatchSuccess: (phone: string) => void;
    onNoMatch: () => void;
  }) => (
    <div data-testid="identity-step">
      <button onClick={() => onMatchSuccess(TEST_PHONE)}>
        Trigger match success
      </button>
      <button onClick={() => onNoMatch()}>Trigger no match</button>
    </div>
  ),
}));

vi.mock('./steps/OtpStep', () => ({
  OtpStep: ({
    phoneNumber,
    onVerified,
  }: {
    phoneNumber: string;
    onVerified: (prefill: typeof TEST_PREFILL | null) => void;
  }) => (
    <div data-testid="otp-step">
      <span data-testid="otp-phone">{phoneNumber}</span>
      <button onClick={() => onVerified(TEST_PREFILL)}>
        Trigger verified with prefill
      </button>
      <button onClick={() => onVerified(null)}>
        Trigger verified without prefill
      </button>
    </div>
  ),
}));

vi.mock('./steps/FallbackIdentityStep', () => ({
  FallbackIdentityStep: ({
    onComplete,
  }: {
    onComplete: (info: typeof TEST_CONFIRMED_INFO) => void;
  }) => (
    <div data-testid="fallback-step">
      <button onClick={() => onComplete(TEST_CONFIRMED_INFO)}>
        Trigger fallback complete
      </button>
    </div>
  ),
}));

vi.mock('./steps/ConfirmInfoStep', () => ({
  ConfirmInfoStep: ({
    info,
    onConfirm,
  }: {
    info: typeof TEST_CONFIRMED_INFO;
    onConfirm: (confirmed: typeof TEST_CONFIRMED_INFO) => void;
  }) => (
    <div data-testid="confirm-step">
      <span data-testid="confirm-first-name">{info.firstName}</span>
      <span data-testid="confirm-source">{info.source}</span>
      <button onClick={() => onConfirm(info)}>Trigger confirm</button>
    </div>
  ),
}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function renderWizard(onComplete = vi.fn()) {
  return render(<StepWizard onComplete={onComplete} />);
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('StepWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Initial render
  it('renders IdentityStep on initial load', () => {
    renderWizard();
    expect(screen.getByTestId('identity-step')).toBeInTheDocument();
    expect(screen.queryByTestId('otp-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fallback-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument();
  });

  // 2. Identity → OTP on match success
  it('transitions to OtpStep when IdentityStep reports a match', () => {
    renderWizard();

    fireEvent.click(screen.getByText('Trigger match success'));

    expect(screen.queryByTestId('identity-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('otp-step')).toBeInTheDocument();
    // Phone number is passed down to OtpStep
    expect(screen.getByTestId('otp-phone')).toHaveTextContent(TEST_PHONE);
  });

  // 3. Identity → Fallback on no-match
  it('transitions to FallbackIdentityStep when IdentityStep reports no match', () => {
    renderWizard();

    fireEvent.click(screen.getByText('Trigger no match'));

    expect(screen.queryByTestId('identity-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback-step')).toBeInTheDocument();
    expect(screen.queryByTestId('otp-step')).not.toBeInTheDocument();
  });

  // 4. OTP → Confirm with prefill data
  it('transitions to ConfirmInfoStep with prefill data after OTP verified', () => {
    renderWizard();

    // Get to OTP step first
    fireEvent.click(screen.getByText('Trigger match success'));

    // Verify with prefill data
    fireEvent.click(screen.getByText('Trigger verified with prefill'));

    expect(screen.queryByTestId('otp-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument();
    // Prefill data is passed to ConfirmInfoStep
    expect(screen.getByTestId('confirm-first-name')).toHaveTextContent('John');
    expect(screen.getByTestId('confirm-source')).toHaveTextContent('prefill');
  });

  // 5. Fallback → Confirm
  it('transitions to ConfirmInfoStep after FallbackIdentityStep completes', () => {
    renderWizard();

    // Get to fallback step
    fireEvent.click(screen.getByText('Trigger no match'));

    // Complete fallback
    fireEvent.click(screen.getByText('Trigger fallback complete'));

    expect(screen.queryByTestId('fallback-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('confirm-step')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-source')).toHaveTextContent('manual');
  });

  // 6. ConfirmInfoStep → done + onComplete called
  it('calls onComplete and renders done state when user confirms', () => {
    const onComplete = vi.fn();
    renderWizard(onComplete);

    // Navigate to confirm step via match → OTP path
    fireEvent.click(screen.getByText('Trigger match success'));
    fireEvent.click(screen.getByText('Trigger verified with prefill'));

    // Confirm
    fireEvent.click(screen.getByText('Trigger confirm'));

    expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument();
    expect(screen.getByText('Identity verified. Proceeding…')).toBeInTheDocument();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'John', source: 'prefill' })
    );
  });

  // Progress indicator — identity step
  it('shows "Step 1 of 5" progress label on identity step', () => {
    renderWizard();
    expect(screen.getByRole('status')).toHaveTextContent('Step 1 of 5');
  });

  // Progress indicator — confirm step
  it('shows "Step 3 of 5" progress label on confirm step', () => {
    renderWizard();
    fireEvent.click(screen.getByText('Trigger match success'));
    fireEvent.click(screen.getByText('Trigger verified with prefill'));
    expect(screen.getByRole('status')).toHaveTextContent('Step 3 of 5');
  });

  // OTP verified without prefill builds blank ConfirmedInfo with source 'manual'
  it('builds blank ConfirmedInfo with source manual when OTP verified without prefill', () => {
    renderWizard();

    fireEvent.click(screen.getByText('Trigger match success'));
    fireEvent.click(screen.getByText('Trigger verified without prefill'));

    expect(screen.getByTestId('confirm-step')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-source')).toHaveTextContent('manual');
    expect(screen.getByTestId('confirm-first-name')).toHaveTextContent('');
  });
});
