'use client';

import { StepWizard } from '../components/StepWizard';
import type { ConfirmedInfo } from '../components/steps/FallbackIdentityStep';

export default function LoanApplicationFlow() {
  function handleComplete(info: ConfirmedInfo) {
    // TODO: advance to the next spec phase (loan form)
    console.log('Identity confirmed, proceeding to loan form', info);
  }

  return <StepWizard onComplete={handleComplete} />;
}
