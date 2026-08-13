/**
 * Recovery-code generation, normalization, and hashing (canonical §6.2).
 * Single-use enforcement is the DB's conditional UPDATE, proven in
 * supabase/tests/security_mfa.sql.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './recovery-codes';

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
});
