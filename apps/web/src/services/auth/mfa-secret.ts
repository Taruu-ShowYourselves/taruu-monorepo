/**
 * TOTP secret encryption at rest (canonical §5.1/§6.1,
 * specs/mfa-engineering-model.md §2.2).
 *
 * AES-256-GCM with the key derived from AUTH_MASTER_KEY under the
 * `mfa_secret_enc` HKDF purpose - key separation between signing and
 * encryption comes from the derivation label, and tokens.ts's SigningPurpose
 * type makes signing with this label a compile error.
 *
 * Blob layout: iv(12 bytes) || ciphertext || tag(16 bytes) - Web Crypto's
 * AES-GCM output already appends the tag to the ciphertext. AAD binds the
 * blob to its owner and row: `user_id || factor_id` (verbatim concatenation,
 * both fixed-length uuids), so a blob copied onto another row fails to
 * decrypt rather than silently authenticating someone else's codes.
 *
 * The plaintext secret exists only in server memory during enroll/verify -
 * never logged, never in an API response after the enrollment-start response.
 */

import { deriveAuthKey, KEY_VERSION } from './keys';

const IV_LENGTH_BYTES = 12;

/** Stamped into user_mfa_factors.enc_key_version alongside every blob. */
export const MFA_SECRET_ENC_KEY_VERSION = KEY_VERSION;

async function getAesKey(): Promise<CryptoKey> {
  const raw = await deriveAuthKey('mfa_secret_enc');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function aad(userId: string, factorId: string): Uint8Array {
  return new TextEncoder().encode(userId + factorId);
}

export async function encryptTotpSecret(
  secret: Uint8Array,
  userId: string,
  factorId: string
): Promise<Uint8Array> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(userId, factorId) } as AesGcmParams,
    key,
    secret as BufferSource
  );

  const blob = new Uint8Array(IV_LENGTH_BYTES + ciphertext.byteLength);
  blob.set(iv, 0);
  blob.set(new Uint8Array(ciphertext), IV_LENGTH_BYTES);
  return blob;
}

/** Returns null on any failure - a wrong AAD, key version, or tampered blob. */
export async function decryptTotpSecret(
  blob: Uint8Array,
  userId: string,
  factorId: string
): Promise<Uint8Array | null> {
  try {
    const key = await getAesKey();
    const iv = blob.slice(0, IV_LENGTH_BYTES);
    const ciphertext = blob.slice(IV_LENGTH_BYTES);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad(userId, factorId) } as AesGcmParams,
      key,
      ciphertext as BufferSource
    );
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

/** PostgREST transports bytea as a `\x`-prefixed hex string. */
export function bytesToPgHex(bytes: Uint8Array): string {
  let hex = '\\x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function pgHexToBytes(pgHex: string): Uint8Array | null {
  const hex = pgHex.startsWith('\\x') ? pgHex.slice(2) : pgHex;
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
