/**
 * Server-side voter eligibility - the enforcement point.
 *
 * `apps/web/src/lib/verification.ts` (`isEligibleToVote`) is what the CLIENT
 * shows: residency is met by a completed program OR at least one successful
 * check-in. A client-side gate is not a gate, so the server applies the same
 * rule from database state, plus the pre-existing `identity_score >= 40`
 * check, which every Google-authenticated user satisfies by construction
 * (auth/callback sets 40) and which is therefore kept rather than relaxed.
 */

import type { User, VerificationRun } from '@/lib/supabase/types';
import { getActiveVerificationRun } from '@/lib/supabase/db';

/** Minimum identity score to cast a ballot. Google sign-in alone scores 40. */
export const MIN_IDENTITY_SCORE = 40;

export type VoterIneligibilityCode = 'IDENTITY_NOT_VERIFIED' | 'RESIDENCY_NOT_VERIFIED';

export type VoterEligibility =
  | { readonly eligible: true }
  | {
      readonly eligible: false;
      readonly code: VoterIneligibilityCode;
      /** Hebrew, user-facing. Never a raw database or gateway string. */
      readonly message: string;
    };

/**
 * Pure mirror of the client rule: the residency program has completed, OR at
 * least one check-in has been logged against the active run.
 */
export function hasVerifiedResidency(
  user: Pick<User, 'verification_status'>,
  activeRun: Pick<VerificationRun, 'completed_check_ins'> | null
): boolean {
  if (user.verification_status === 'verified') return true;
  return (activeRun?.completed_check_ins ?? 0) >= 1;
}

/** Pure decision, given everything already loaded. */
export function decideVoterEligibility(
  user: Pick<User, 'verification_status' | 'identity_score'>,
  activeRun: Pick<VerificationRun, 'completed_check_ins'> | null
): VoterEligibility {
  if ((user.identity_score ?? 0) < MIN_IDENTITY_SCORE) {
    return {
      eligible: false,
      code: 'IDENTITY_NOT_VERIFIED',
      message: 'נדרש אימות זהות לפני ההצבעה.',
    };
  }
  if (!hasVerifiedResidency(user, activeRun)) {
    return {
      eligible: false,
      code: 'RESIDENCY_NOT_VERIFIED',
      message: 'נדרש אימות תושבוּת לפני ההצבעה.',
    };
  }
  return { eligible: true };
}

/** Async shell: loads the active run, then defers to the pure decision. */
export async function checkVoterEligibility(
  user: Pick<User, 'id' | 'verification_status' | 'identity_score'>
): Promise<VoterEligibility> {
  if ((user.identity_score ?? 0) < MIN_IDENTITY_SCORE) {
    return decideVoterEligibility(user, null);
  }
  const activeRun = await getActiveVerificationRun(user.id);
  return decideVoterEligibility(user, activeRun);
}
