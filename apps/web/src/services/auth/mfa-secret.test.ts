/**
 * TOTP secret encryption at rest (canonical §5.1/§6.1): AES-256-GCM under
 * the mfa_secret_enc HKDF purpose, AAD-bound to (user_id, factor_id) so a
 * blob moved onto another row refuses to decrypt.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FACTOR_ID = '22222222-2222-4222-8222-222222222222';

async function loadModule() {
  vi.resetModules();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  const keys = await import('./keys');
  keys.resetDerivedKeyCache();
  return import('./mfa-secret');
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('encryptTotpSecret / decryptTotpSecret', () => {
  it('round-trips a secret for its own (user, factor) pair', async () => {
    const { encryptTotpSecret, decryptTotpSecret } = await loadModule();
    const secret = crypto.getRandomValues(new Uint8Array(20));

    const blob = await encryptTotpSecret(secret, USER_ID, FACTOR_ID);
    const decrypted = await decryptTotpSecret(blob, USER_ID, FACTOR_ID);

    expect(decrypted).not.toBeNull();
    expect(Buffer.from(decrypted!)).toEqual(Buffer.from(secret));
    // iv(12) + ciphertext(20) + tag(16)
    expect(blob).toHaveLength(48);
  });

  it('refuses to decrypt under a different user or factor (AAD binding)', async () => {
    const { encryptTotpSecret, decryptTotpSecret } = await loadModule();
    const secret = crypto.getRandomValues(new Uint8Array(20));
    const blob = await encryptTotpSecret(secret, USER_ID, FACTOR_ID);

    expect(await decryptTotpSecret(blob, '33333333-3333-4333-8333-333333333333', FACTOR_ID)).toBeNull();
    expect(await decryptTotpSecret(blob, USER_ID, '44444444-4444-4444-8444-444444444444')).toBeNull();
  });

  it('refuses a tampered blob', async () => {
    const { encryptTotpSecret, decryptTotpSecret } = await loadModule();
    const blob = await encryptTotpSecret(crypto.getRandomValues(new Uint8Array(20)), USER_ID, FACTOR_ID);
    blob[blob.length - 1] ^= 0x01;
    expect(await decryptTotpSecret(blob, USER_ID, FACTOR_ID)).toBeNull();
  });

  it('uses a fresh iv per encryption', async () => {
    const { encryptTotpSecret } = await loadModule();
    const secret = crypto.getRandomValues(new Uint8Array(20));
    const a = await encryptTotpSecret(secret, USER_ID, FACTOR_ID);
    const b = await encryptTotpSecret(secret, USER_ID, FACTOR_ID);
    expect(Buffer.from(a.slice(0, 12)).equals(Buffer.from(b.slice(0, 12)))).toBe(false);
  });
});

describe('pg bytea transport', () => {
  it('round-trips through the \\x hex format', async () => {
    const { bytesToPgHex, pgHexToBytes } = await loadModule();
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const hex = bytesToPgHex(bytes);
    expect(hex.startsWith('\\x')).toBe(true);
    expect(Buffer.from(pgHexToBytes(hex)!)).toEqual(Buffer.from(bytes));
  });

  it('rejects malformed hex', async () => {
    const { pgHexToBytes } = await loadModule();
    expect(pgHexToBytes('\\xZZ')).toBeNull();
    expect(pgHexToBytes('\\xabc')).toBeNull();
  });
});
