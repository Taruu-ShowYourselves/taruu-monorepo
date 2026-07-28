/**
 * Keyed hashing for identifier dedup (Web Crypto — Workers-safe).
 *
 * The ID number is never persisted in cleartext; only this HMAC lands in the
 * database, so the raw number cannot be recovered while dedup (one person,
 * one account) still works.
 */

import { errAsync, ResultAsync } from 'neverthrow';
import { internal, type AppError } from '@/server/http/errors';

function secret(): string | null {
  return process.env.IDENTITY_HASH_SECRET || process.env.JWT_SECRET || null;
}

export function hmacIdentifier(value: string): ResultAsync<string, AppError> {
  const key = secret();
  if (!key) {
    return errAsync(internal('IDENTITY_HASH_SECRET is not configured'));
  }
  const task = (async () => {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      new TextEncoder().encode(value)
    );
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  })();
  return ResultAsync.fromPromise(task, (cause) => internal(cause));
}
