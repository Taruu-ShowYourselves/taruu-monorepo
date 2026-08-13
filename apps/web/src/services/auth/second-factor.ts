/**
 * Second-factor verification - the one implementation shared by the login
 * challenge (§5.5), reauthentication (§5.6), and enrollment confirm (§5.3).
 *
 * Verification here never *accepts* anything on its own: a TOTP match is
 * only accepted once the database's monotonic step guard
 * (`mfa_accept_totp_step`) wins, and a recovery code only once its
 * conditional-UPDATE spend wins. Two concurrent submissions of the same
 * code produce exactly one success, and that guarantee lives in Postgres,
 * not here (specs/mfa-engineering-model.md §5.5).
 */

import { getActiveFactor, acceptTotpStep, consumeRecoveryCode, countUnusedRecoveryCodes } from '@/lib/supabase/mfa';
import { decryptTotpSecret, pgHexToBytes } from './mfa-secret';
import { findMatchingStep } from './totp';
import { hashRecoveryCode } from './recovery-codes';

export type SecondFactorMethod = 'totp' | 'recovery';

export interface SecondFactorResult {
  ok: boolean;
  method: SecondFactorMethod;
  /** After a successful recovery spend: how many unused codes remain. */
  remainingRecoveryCodes?: number;
}

/** A recovery code submission: 16 base32 chars, usually dash-grouped. */
export function looksLikeRecoveryCode(code: string): boolean {
  return code.replace(/[\s-]+/g, '').length >= 10;
}

/**
 * Verifies a TOTP code against the user's ACTIVE factor and commits the
 * accepted step through the DB monotonic guard. False for: no active factor,
 * undecryptable secret, no matching step in the ±1 window, or a step the
 * guard refused (replay / concurrent acceptance).
 */
export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const factor = await getActiveFactor(userId);
  if (!factor) return false;

  const blob = pgHexToBytes(factor.secret_enc);
  if (!blob) return false;

  const secret = await decryptTotpSecret(blob, userId, factor.id);
  if (!secret) return false;

  const step = await findMatchingStep(secret, code);
  if (step === null) return false;

  return acceptTotpStep(factor.id, userId, step);
}

/**
 * Spends a recovery code atomically. Requires an active factor - recovery
 * codes exist only because an enrollment completed, and a disabled factor's
 * codes were deleted with it.
 */
export async function verifyRecoveryCodeForUser(
  userId: string,
  code: string
): Promise<{ ok: boolean; remaining: number }> {
  const factor = await getActiveFactor(userId);
  if (!factor) return { ok: false, remaining: 0 };

  const hash = await hashRecoveryCode(code);
  const ok = await consumeRecoveryCode(userId, hash);
  const remaining = ok ? (await countUnusedRecoveryCodes(userId)) ?? 0 : 0;
  return { ok, remaining };
}

/**
 * Routes a submission to the right verifier by shape: 6 digits = TOTP,
 * longer = recovery code. `allowedMethods` is derived server-side by the
 * caller (§5.6a policy matrix) - a method not in the list is refused before
 * any verification work.
 */
export async function verifySecondFactor(
  userId: string,
  code: string,
  allowedMethods: readonly SecondFactorMethod[]
): Promise<SecondFactorResult> {
  const trimmed = code.trim();

  if (/^\d{6}$/.test(trimmed.replace(/\s+/g, ''))) {
    if (!allowedMethods.includes('totp')) return { ok: false, method: 'totp' };
    return { ok: await verifyTotpForUser(userId, trimmed), method: 'totp' };
  }

  if (looksLikeRecoveryCode(trimmed)) {
    if (!allowedMethods.includes('recovery')) return { ok: false, method: 'recovery' };
    const { ok, remaining } = await verifyRecoveryCodeForUser(userId, trimmed);
    return { ok, method: 'recovery', remainingRecoveryCodes: remaining };
  }

  return { ok: false, method: 'totp' };
}
