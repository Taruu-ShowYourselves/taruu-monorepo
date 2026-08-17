/**
 * Recovery codes (canonical §6.2, specs/mfa-engineering-model.md §5.4).
 *
 * 10 codes per batch, 16 Crockford-base32 characters grouped
 * XXXX-XXXX-XXXX-XXXX (80 bits each), from crypto.getRandomValues. The
 * database stores HMAC-SHA-256 hex digests only, keyed by a pepper derived
 * from AUTH_MASTER_KEY (HKDF `recovery_pepper` label, PR #120 review,
 * finding 7) - a leaked `user_recovery_codes` dump is worthless without the
 * server-side key. Plaintext is shown exactly once in the enroll-confirm
 * (or regenerate) response. Spending is the atomic conditional UPDATE in
 * `mfa_consume_recovery_code` - never checked here.
 */

import { deriveAuthKey } from './keys';

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

/**
 * HMAC-SHA-256 hex of the normalized code, keyed by the HKDF-derived
 * `recovery_pepper` (never bare SHA-256: an offline attacker holding a
 * `user_recovery_codes` dump could grind 80-bit codes; with the pepper the
 * dump alone verifies nothing). No back-compat path on purpose - this PR is
 * unreleased, so no bare-SHA-256 rows exist anywhere.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const pepper = await deriveAuthKey('recovery_pepper');
  const key = await crypto.subtle.importKey(
    'raw',
    pepper as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(normalizeRecoveryCode(code)) as BufferSource
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
