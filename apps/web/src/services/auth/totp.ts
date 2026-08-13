/**
 * RFC 6238 TOTP - the interoperable profile every mainstream authenticator
 * implements: HMAC-SHA1, 6 digits, 30-second steps (canonical §6.1).
 *
 * Web Crypto only (`crypto.subtle`) - the runtime is Cloudflare Workers via
 * OpenNext, and the house rule forbids `node:crypto` here (precedents:
 * services/sms/otp.ts, server/infra/crypto/hmac.ts). Code comparison goes
 * through `secureEqual` (the sanctioned timingSafeEqual wrapper).
 *
 * This module computes and matches codes; it does NOT decide acceptance.
 * Acceptance is the database's monotonic step guard
 * (`mfa_accept_totp_step` / `mfa_activate_factor`, §6.4b) - the same code can
 * never be accepted twice even under concurrent submission, and that
 * guarantee deliberately does not live in JavaScript.
 */

import { secureEqual } from '@/lib/secureCompare';

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** ±1 step = ±30s clock skew allowed (canonical §6.4b). */
export const TOTP_SKEW_STEPS = 1;
export const TOTP_SECRET_BYTES = 20;

/** RFC 4648 base32 alphabet - what otpauth secrets use. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(TOTP_SECRET_BYTES));
}

/** RFC 4648 base32, no padding - the otpauth `secret` parameter format. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** The TOTP time-step for a given instant: floor(unixSeconds / 30). */
export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** RFC 4226 HOTP with the RFC 6238 time-step as the counter. */
export async function totpCodeForStep(secret: Uint8Array, step: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // 8-byte big-endian counter. Steps stay far below 2^53, so the split into
  // two 32-bit halves is exact.
  const counter = new Uint8Array(8);
  const view = new DataView(counter.buffer);
  view.setUint32(0, Math.floor(step / 0x100000000));
  view.setUint32(4, step >>> 0);

  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter as BufferSource));

  // RFC 4226 §5.3 dynamic truncation.
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Finds the step within the ±TOTP_SKEW_STEPS window whose code equals the
 * submission, or null. The caller MUST then run the returned step through the
 * database's monotonic guard before treating the code as accepted.
 */
export async function findMatchingStep(
  secret: Uint8Array,
  submittedCode: string,
  nowStep: number = totpStep()
): Promise<number | null> {
  const normalized = submittedCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;

  for (let offset = -TOTP_SKEW_STEPS; offset <= TOTP_SKEW_STEPS; offset++) {
    const candidate = nowStep + offset;
    const expected = await totpCodeForStep(secret, candidate);
    if (secureEqual(expected, normalized)) {
      return candidate;
    }
  }
  return null;
}

/**
 * The enrollment otpauth URI (canonical §6.1) - rendered as a QR and offered
 * for manual entry. Returned exactly once, in the enrollment-start response.
 */
export function buildOtpauthUri(email: string, base32Secret: string): string {
  const label = encodeURIComponent(`Taruu:${email}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer: 'Taruu',
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
