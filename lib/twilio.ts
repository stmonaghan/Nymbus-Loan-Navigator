import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendOtp(
  phone: string
): Promise<{ sid: string } | null> {
  try {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms' });
    return { sid: verification.sid };
  } catch (err) {
    console.error('[sendOtp] Twilio error:', err);
    return null;
  }
}

export async function checkOtp(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });
    return check.status === 'approved';
  } catch (err) {
    console.error('[checkOtp] Twilio error:', err);
    return false;
  }
}
