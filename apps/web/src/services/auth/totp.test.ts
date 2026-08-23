/**
 * RFC 6238 conformance and skew-window behavior for the TOTP primitive
 * (canonical §16b: "RFC 6238 reference vectors; clock skew ±1 step accepted,
 * ±2 rejected"). Acceptance/replay is the DB's monotonic guard, tested in
 * supabase/tests/security_mfa.sql - here we only prove code computation and
 * window matching.
 */

import { describe, it, expect } from 'vitest';
import {
  totpCodeForStep,
  totpStep,
  findMatchingStep,
  base32Encode,
  buildOtpauthUri,
  generateTotpSecret,
  TOTP_PERIOD_SECONDS,
  TOTP_SECRET_BYTES,
} from './totp';

// RFC 6238 Appendix B secret for HMAC-SHA1: ASCII "12345678901234567890".
const RFC_SECRET = new TextEncoder().encode('12345678901234567890');

// RFC 6238 Appendix B reference vectors (SHA-1 rows), truncated to the
// interoperable 6 digits from the published 8-digit values.
const RFC_VECTORS: Array<[unixSeconds: number, sixDigits: string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
];

describe('totpCodeForStep', () => {
  it.each(RFC_VECTORS)('matches the RFC 6238 vector at t=%d', async (t, expected) => {
    const step = Math.floor(t / TOTP_PERIOD_SECONDS);
    expect(await totpCodeForStep(RFC_SECRET, step)).toBe(expected);
  });
});

describe('findMatchingStep', () => {
  const NOW_STEP = totpStep(1111111111 * 1000);

  it('accepts the current step and returns it', async () => {
    const code = await totpCodeForStep(RFC_SECRET, NOW_STEP);
    expect(await findMatchingStep(RFC_SECRET, code, NOW_STEP)).toBe(NOW_STEP);
  });

  it('accepts ±1 step of clock skew', async () => {
    const behind = await totpCodeForStep(RFC_SECRET, NOW_STEP - 1);
    const ahead = await totpCodeForStep(RFC_SECRET, NOW_STEP + 1);
    expect(await findMatchingStep(RFC_SECRET, behind, NOW_STEP)).toBe(NOW_STEP - 1);
    expect(await findMatchingStep(RFC_SECRET, ahead, NOW_STEP)).toBe(NOW_STEP + 1);
  });

  it('rejects ±2 steps - outside the skew window', async () => {
    const tooOld = await totpCodeForStep(RFC_SECRET, NOW_STEP - 2);
    const tooNew = await totpCodeForStep(RFC_SECRET, NOW_STEP + 2);
    expect(await findMatchingStep(RFC_SECRET, tooOld, NOW_STEP)).toBeNull();
    expect(await findMatchingStep(RFC_SECRET, tooNew, NOW_STEP)).toBeNull();
  });

  it('rejects a wrong code and malformed input', async () => {
    expect(await findMatchingStep(RFC_SECRET, '000000', NOW_STEP)).toBeNull();
    expect(await findMatchingStep(RFC_SECRET, '12345', NOW_STEP)).toBeNull();
    expect(await findMatchingStep(RFC_SECRET, 'abcdef', NOW_STEP)).toBeNull();
  });

  it('tolerates whitespace in the submission (authenticator copy-paste)', async () => {
    const code = await totpCodeForStep(RFC_SECRET, NOW_STEP);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(await findMatchingStep(RFC_SECRET, spaced, NOW_STEP)).toBe(NOW_STEP);
  });
});

describe('base32Encode', () => {
  it('matches RFC 4648 vectors (unpadded)', () => {
    expect(base32Encode(new TextEncoder().encode('f'))).toBe('MY');
    expect(base32Encode(new TextEncoder().encode('fo'))).toBe('MZXQ');
    expect(base32Encode(new TextEncoder().encode('foo'))).toBe('MZXW6');
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
  });
});

describe('buildOtpauthUri', () => {
  it('emits the interoperable SHA1/6/30 profile with issuer and label', () => {
    const uri = buildOtpauthUri('user@example.com', 'MZXW6YTBOI');
    expect(uri).toBe(
      'otpauth://totp/Taruu%3Auser%40example.com?secret=MZXW6YTBOI&issuer=Taruu&algorithm=SHA1&digits=6&period=30'
    );
  });
});

describe('generateTotpSecret', () => {
  it('produces 20 bytes and distinct secrets', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toHaveLength(TOTP_SECRET_BYTES);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});
