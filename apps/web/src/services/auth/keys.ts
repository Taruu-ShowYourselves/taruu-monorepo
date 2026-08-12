/**
 * AUTH_MASTER_KEY and HKDF per-purpose key derivation.
 *
 * This is the ONLY module that reads `AUTH_MASTER_KEY`. Every signing/verifying
 * module derives its purpose-specific key from here rather than touching the
 * master key or an env var directly (canonical §4.1).
 *
 * M1 declares exactly three purposes: session, refresh, oauth_state. The
 * canonical §4.1 catalog also lists mfa_pending, reauth and mfa_secret_enc -
 * those are M2 scope and must not be derived, declared, or referenced here.
 *
 * Runtime is Cloudflare Workers via OpenNext (nodejs_compat) - derivation uses
 * Web Crypto (`crypto.subtle`), never `node:crypto`'s `hkdfSync`.
 */

export type TokenPurpose = 'session' | 'refresh' | 'oauth_state';

/** HKDF salt for every M1 purpose key. Versioned alongside KEY_VERSION below. */
export const HKDF_SALT = 'taruu-auth-v1';
/** Derived key length in bytes (HS256 wants a 256-bit key). */
export const DERIVED_KEY_LENGTH_BYTES = 32;
/** HKDF hash algorithm. */
export const HKDF_HASH = 'SHA-256';
/** Numeric key version stamped into encrypted blobs / token headers alongside JWT_KEY_ID. */
export const KEY_VERSION = 1;
/** JWT protected-header `kid` for the current key version. */
export const JWT_KEY_ID = 'v1';

/**
 * Reads `AUTH_MASTER_KEY` at call time (not at module load - the test suite
 * and the Workers runtime both populate env after import). Throws loudly when
 * absent, empty, or under 32 characters. There is no fallback: never read
 * `JWT_SECRET`, never synthesize a default, never degrade in development.
 */
export function getAuthMasterKey(): string {
  const key = process.env.AUTH_MASTER_KEY;
  if (!key || key.length < DERIVED_KEY_LENGTH_BYTES) {
    throw new Error(
      'AUTH_MASTER_KEY is missing or too short (must be at least 32 characters). ' +
        'There is no fallback - set it before minting or verifying any token.'
    );
  }
  return key;
}

const derivedKeyCache = new Map<TokenPurpose, Promise<Uint8Array>>();

async function deriveAuthKeyUncached(purpose: TokenPurpose): Promise<Uint8Array> {
  const masterKey = getAuthMasterKey();
  const ikm = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterKey),
    'HKDF',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: HKDF_HASH,
      salt: new TextEncoder().encode(HKDF_SALT),
      info: new TextEncoder().encode(purpose),
    },
    ikm,
    DERIVED_KEY_LENGTH_BYTES * 8
  );

  return new Uint8Array(bits);
}

/**
 * Derives the 32-byte HKDF key for a purpose. Memoized in a module-level map
 * so repeated mint/verify calls do not re-derive on every request - this memo
 * is a deterministic-derivation cache, not a security cache; it holds no user
 * state.
 */
export function deriveAuthKey(purpose: TokenPurpose): Promise<Uint8Array> {
  let cached = derivedKeyCache.get(purpose);
  if (!cached) {
    cached = deriveAuthKeyUncached(purpose);
    derivedKeyCache.set(purpose, cached);
  }
  return cached;
}

/**
 * Test-only: clears the derived-key memo so an env change between test cases
 * takes effect. Never call this from production code.
 */
export function resetDerivedKeyCache(): void {
  derivedKeyCache.clear();
}
