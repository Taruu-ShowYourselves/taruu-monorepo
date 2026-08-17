/**
 * Recovery-code generation, normalization, and hashing (canonical §6.2).
 * Single-use enforcement is the DB's conditional UPDATE, proven in
 * supabase/tests/security_mfa.sql. Hashing is HMAC-SHA-256 keyed by the
 * HKDF-derived `recovery_pepper` off AUTH_MASTER_KEY (PR #120 review,
 * finding 7), so the suite stubs the master key like the other kernel tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './recovery-codes';
import { resetDerivedKeyCache } from './keys';

beforeEach(() => {
  vi.stubEnv('AUTH_MASTER_KEY', 'a'.repeat(32));
  resetDerivedKeyCache();
});

describe('generateRecoveryCodes', () => {
  it('produces 10 distinct codes in XXXX-XXXX-XXXX-XXXX Crockford format', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      // Crockford base32: no I, L, O, U.
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    }
  });
});

describe('normalizeRecoveryCode', () => {
  it('strips separators and whitespace, uppercases', () => {
    expect(normalizeRecoveryCode('ab12-cd34-ef56-gh78')).toBe('AB12CD34EF56GH78');
    expect(normalizeRecoveryCode(' AB12 CD34\tEF56-GH78 ')).toBe('AB12CD34EF56GH78');
  });

  it('folds Crockford confusables: I/L -> 1, O -> 0', () => {
    expect(normalizeRecoveryCode('OIL0')).toBe('0110');
  });
});

describe('hashRecoveryCode', () => {
  it('is stable across formatting variants of the same code', async () => {
    const canonical = await hashRecoveryCode('AB12-CD34-EF56-GH78');
    expect(await hashRecoveryCode('ab12cd34ef56gh78')).toBe(canonical);
    expect(await hashRecoveryCode(' AB12 CD34 EF56 GH78 ')).toBe(canonical);
  });

  it('produces 64 hex chars and differs across codes', async () => {
    const a = await hashRecoveryCode('AAAA-AAAA-AAAA-AAAA');
    const b = await hashRecoveryCode('BBBB-BBBB-BBBB-BBBB');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('is peppered: the digest depends on AUTH_MASTER_KEY, not the code alone', async () => {
    const underKeyA = await hashRecoveryCode('AB12-CD34-EF56-GH78');

    vi.stubEnv('AUTH_MASTER_KEY', 'b'.repeat(32));
    resetDerivedKeyCache();
    const underKeyB = await hashRecoveryCode('AB12-CD34-EF56-GH78');

    expect(underKeyA).not.toBe(underKeyB);
  });

  it('is not bare SHA-256 of the normalized code', async () => {
    const bareSha = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('AB12CD34EF56GH78') as BufferSource
    );
    const bareHex = Array.from(new Uint8Array(bareSha), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    expect(await hashRecoveryCode('AB12-CD34-EF56-GH78')).not.toBe(bareHex);
  });

  it('refuses to hash without AUTH_MASTER_KEY (no unpeppered fallback)', async () => {
    vi.stubEnv('AUTH_MASTER_KEY', '');
    resetDerivedKeyCache();
    await expect(hashRecoveryCode('AB12-CD34-EF56-GH78')).rejects.toThrow(/AUTH_MASTER_KEY/);
  });
});
