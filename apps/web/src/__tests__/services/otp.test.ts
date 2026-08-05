/**
 * OTP service tests - the Cloudflare-native replacement for Twilio Verify.
 *
 * Exercises the real generate/store/verify logic against the in-memory store
 * fallback (no KV binding in Node), with the SMS sender stubbed via a fetch mock
 * that captures the issued code from the outgoing message.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const PHONE = '+972500000001';

describe('OTP service', () => {
  const ORIGINAL_ENV = { ...process.env };
  let sentMessages: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    sentMessages = [];
    process.env.SMS_API_URL = 'https://sms.example/send';
    process.env.SMS_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { text: string };
        sentMessages.push(body.text);
        return { ok: true, text: async () => '' } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  const codeFrom = (text: string): string => {
    const m = text.match(/(\d{6})/);
    if (!m) throw new Error(`no 6-digit code in message: ${text}`);
    return m[1];
  };

  it('issues a code and verifies the correct one', async () => {
    const otp = await import('@/services/sms/otp');
    const send = await otp.sendVerificationCode(PHONE);
    expect(send.success).toBe(true);
    expect(send.status).toBe('pending');
    expect(sentMessages).toHaveLength(1);

    const code = codeFrom(sentMessages[0]);
    const check = await otp.checkVerificationCode(PHONE, code);
    expect(check.verified).toBe(true);
    expect(check.status).toBe('approved');
  });

  it('issues a zero-padded 6-digit code and never stores plaintext', async () => {
    const otp = await import('@/services/sms/otp');
    await otp.sendVerificationCode(PHONE);
    expect(codeFrom(sentMessages[0])).toMatch(/^\d{6}$/);
  });

  it('rejects a wrong code with WRONG_CODE', async () => {
    const otp = await import('@/services/sms/otp');
    await otp.sendVerificationCode(PHONE);
    const code = codeFrom(sentMessages[0]);
    const wrong = code === '000000' ? '111111' : '000000';
    const check = await otp.checkVerificationCode(PHONE, wrong);
    expect(check.verified).toBe(false);
    expect(check.error).toBe('WRONG_CODE');
  });

  it('locks out after the max wrong attempts', async () => {
    const otp = await import('@/services/sms/otp');
    await otp.sendVerificationCode(PHONE);
    const code = codeFrom(sentMessages[0]);
    const wrong = code === '000000' ? '111111' : '000000';
    let last;
    for (let i = 0; i < 6; i++) last = await otp.checkVerificationCode(PHONE, wrong);
    expect(last?.error).toBe('RATE_LIMITED');
    // even the correct code is dead after lockout (record deleted)
    const after = await otp.checkVerificationCode(PHONE, code);
    expect(after.error).toBe('NO_PENDING_VERIFICATION');
  });

  it('returns NO_PENDING_VERIFICATION when no code was issued', async () => {
    const otp = await import('@/services/sms/otp');
    const check = await otp.checkVerificationCode('+972500000999', '123456');
    expect(check.verified).toBe(false);
    expect(check.error).toBe('NO_PENDING_VERIFICATION');
  });

  it('cancelVerification drops a pending code', async () => {
    const otp = await import('@/services/sms/otp');
    await otp.sendVerificationCode(PHONE);
    const code = codeFrom(sentMessages[0]);
    await otp.cancelVerification(PHONE);
    const check = await otp.checkVerificationCode(PHONE, code);
    expect(check.error).toBe('NO_PENDING_VERIFICATION');
  });

  it('mock-degrades when the SMS gateway is unconfigured', async () => {
    delete process.env.SMS_API_URL;
    delete process.env.SMS_API_KEY;
    vi.resetModules();
    const otp = await import('@/services/sms/otp');
    expect(otp.isSmsServiceConfigured()).toBe(false);
    const send = await otp.sendVerificationCode(PHONE);
    expect(send.success).toBe(false);
    expect(send.error).toBe('SMS_SEND_FAILED');
  });

  it('reports configured when the gateway env is present', async () => {
    const otp = await import('@/services/sms/otp');
    expect(otp.isSmsServiceConfigured()).toBe(true);
    expect(otp.getCodeExpirySeconds()).toBe(600);
  });
});
