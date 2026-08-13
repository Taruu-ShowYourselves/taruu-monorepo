/**
 * Recovery codes (canonical §6.2, specs/mfa-engineering-model.md §5.4).
 *
 * 10 codes per batch, 16 Crockford-base32 characters grouped
 * XXXX-XXXX-XXXX-XXXX (80 bits each), from crypto.getRandomValues. The
 * database stores SHA-256 hex hashes only; plaintext is shown exactly once in
 * the enroll-confirm (or regenerate) response. Spending is the atomic
 * conditional UPDATE in `mfa_consume_recovery_code` - never checked here.
 */

export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_CHARS = 16;
/** UIs surface a regenerate warning at or below this many unused codes. */
export const RECOVERY_LOW_WATERMARK = 2;

/** Crockford base32: no I, L, O, U - unambiguous to read back over the phone. */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateOneCode(): string {
  // 32 divides 256, so byte % 32 is uniform - no rejection sampling needed.
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_CODE_CHARS));
  let raw = '';
  for (const b of bytes) raw += CROCKFORD_ALPHABET[b % 32];
  return raw.match(/.{4}/g)!.join('-');
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateOneCode);
}

/**
 * Normalization before hashing, applied identically at generation and at
 * verification: strip separators/whitespace, uppercase, and fold Crockford's
 * confusable characters (I/L -> 1, O -> 0) so a user reading a printed code
 * back cannot fail on typography.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

/** SHA-256 hex of the normalized code (mold: services/sms/otp.ts). */
export async function hashRecoveryCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalizeRecoveryCode(code)) as BufferSource
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
