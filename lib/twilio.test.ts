import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the twilio module before importing lib/twilio
vi.mock('twilio', () => {
  const mockVerificationChecksCreate = vi.fn();
  const mockVerificationsCreate = vi.fn();
  const mockService = {
    verifications: { create: mockVerificationsCreate },
    verificationChecks: { create: mockVerificationChecksCreate },
  };
  const mockClient = {
    verify: { v2: { services: vi.fn(() => mockService) } },
  };
  return { default: vi.fn(() => mockClient) };
});

import twilio from 'twilio';
import { sendOtp, checkOtp } from './twilio';

function getMocks() {
  const client = (twilio as ReturnType<typeof vi.fn>).mock.results[0].value;
  return {
    verificationsCreate: client.verify.v2.services().verifications.create as ReturnType<typeof vi.fn>,
    verificationChecksCreate: client.verify.v2.services().verificationChecks.create as ReturnType<typeof vi.fn>,
  };
}

describe('sendOtp', () => {
  it('returns { sid } on success', async () => {
    const mocks = getMocks();
    mocks.verificationsCreate.mockResolvedValueOnce({ sid: 'VE123' });
    const result = await sendOtp('+15555550123');
    expect(result).toEqual({ sid: 'VE123' });
  });

  it('returns null when Twilio throws', async () => {
    const mocks = getMocks();
    mocks.verificationsCreate.mockRejectedValueOnce(new Error('network error'));
    const result = await sendOtp('+15555550123');
    expect(result).toBeNull();
  });
});

describe('checkOtp', () => {
  it('returns true when status is approved', async () => {
    const mocks = getMocks();
    mocks.verificationChecksCreate.mockResolvedValueOnce({ status: 'approved' });
    const result = await checkOtp('+15555550123', '123456');
    expect(result).toBe(true);
  });

  it('returns false when status is not approved', async () => {
    const mocks = getMocks();
    mocks.verificationChecksCreate.mockResolvedValueOnce({ status: 'pending' });
    const result = await checkOtp('+15555550123', '000000');
    expect(result).toBe(false);
  });

  it('returns false when Twilio throws', async () => {
    const mocks = getMocks();
    mocks.verificationChecksCreate.mockRejectedValueOnce(new Error('timeout'));
    const result = await checkOtp('+15555550123', '123456');
    expect(result).toBe(false);
  });
});
