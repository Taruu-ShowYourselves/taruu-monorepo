/**
 * Phone OTP service (Cloudflare-native).
 *
 * Replaces the Twilio Verify managed product: codes are generated, hashed, and
 * verified in-app, with state in Workers KV (see store.ts) and delivery via a
 * pluggable SMS gateway (see sender.ts). Exposes the same contract the phone
 * routes already depend on, so `/api/user/phone/*` is unchanged:
 *   sendVerificationCode · checkVerificationCode · cancelVerification
 *   isSmsServiceConfigured · getCodeExpirySeconds
 */

import type { PHONE_ERROR_MESSAGES } from '@sync/shared';
import { getOtpStore } from './store';
import { getSmsSender, isSmsServiceConfigured as senderConfigured } from './sender';

const CODE_TTL_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

export type VerificationStatus = 'pending' | 'approved' | 'canceled' | 'expired';

export interface SendVerificationResult {
  success: boolean;
  status?: VerificationStatus;
  error?: keyof typeof PHONE_ERROR_MESSAGES;
  errorMessage?: string;
}

export interface CheckVerificationResult {
  success: boolean;
  verified: boolean;
  status?: VerificationStatus;
  error?: keyof typeof PHONE_ERROR_MESSAGES;
  errorMessage?: string;
}

/** SHA-256 hex via Web Crypto (available on the Workers runtime and Node). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Cryptographically-random 6-digit code, zero-padded. */
function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

/** Constant-time compare of two equal-purpose hex strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Issue a code and deliver it. Stores only the hash; the plaintext lives only
 * in the SMS. E.164 phone expected (routes normalise before calling).
 */
export async function sendVerificationCode(phone: string): Promise<SendVerificationResult> {
  const sender = getSmsSender();
  if (!sender) {
    console.error('SMS sender is not configured');
    return { success: false, error: 'SMS_SEND_FAILED', errorMessage: 'SMS service is not configured' };
  }

  const code = generateCode();
  const store = await getOtpStore();
  await store.set(
    phone,
    { codeHash: await sha256Hex(code), attempts: 0, createdAt: Date.now() },
    CODE_TTL_SECONDS
  );

  try {
    await sender.send(phone, `קוד האימות שלך לתַּרְאוּ: ${code}`);
    return { success: true, status: 'pending' };
  } catch (error: unknown) {
    // Delivery failed - drop the stored code so a retry issues a fresh one.
    await store.delete(phone);
    console.error('Error sending verification SMS:', error);
    return {
      success: false,
      error: 'SMS_SEND_FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify a submitted code. Wrong codes count toward MAX_ATTEMPTS; on success or
 * lockout the record is deleted. Constant-time hash comparison.
 */
export async function checkVerificationCode(
  phone: string,
  code: string
): Promise<CheckVerificationResult> {
  const store = await getOtpStore();
  const record = await store.get(phone);

  if (!record) {
    return {
      success: false,
      verified: false,
      status: 'expired',
      error: 'NO_PENDING_VERIFICATION',
      errorMessage: 'No pending verification found',
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await store.delete(phone);
    return {
      success: false,
      verified: false,
      status: 'canceled',
      error: 'RATE_LIMITED',
      errorMessage: 'Too many verification attempts',
    };
  }

  const matches = safeEqual(record.codeHash, await sha256Hex(code));
  if (matches) {
    await store.delete(phone);
    return { success: true, verified: true, status: 'approved' };
  }

  // Wrong code - increment attempts, preserving the remaining TTL window.
  const remaining = Math.max(
    1,
    CODE_TTL_SECONDS - Math.floor((Date.now() - record.createdAt) / 1000)
  );
  await store.set(phone, { ...record, attempts: record.attempts + 1 }, remaining);
  return {
    success: false,
    verified: false,
    status: 'pending',
    error: 'WRONG_CODE',
    errorMessage: 'Incorrect verification code',
  };
}

/** Drop any pending code for a phone (best-effort cleanup). */
export async function cancelVerification(phone: string): Promise<void> {
  try {
    const store = await getOtpStore();
    await store.delete(phone);
  } catch (error) {
    console.error('Error canceling verification:', error);
  }
}

/** True when SMS delivery is configured (otherwise routes 503 → client soft-pass). */
export function isSmsServiceConfigured(): boolean {
  return senderConfigured();
}

/** Code lifetime in seconds. */
export function getCodeExpirySeconds(): number {
  return CODE_TTL_SECONDS;
}
