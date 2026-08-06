/**
 * Server-side voter eligibility - the enforcement point.
 *
 * `apps/web/src/lib/verification.ts` (`isEligibleToVote`) is what the CLIENT
 * shows: residency is met by a completed program OR at least one successful
 * check-in. A client-side gate is not a gate, so the server applies the same
 * rule from database state, and scores it: residency is worth 40 points, and a
 * ballot needs 80.
 *
 * Which makes residency load-bearing rather than advisory. Sign-in scores 40
 * and both social proofs together add 20, so no arrangement of accounts reaches
 * 80 without the GPS programme - one ballot per real resident of the
 * municipality, with the residency check evidencing the second half of that.
 */

import { MINIMUM_VOTING_SCORE, votingGate } from '@sync/shared';
import type { User, VerificationRun } from '@/lib/supabase/types';
import { getActiveVerificationRun } from '@/lib/supabase/db';

/** Minimum score to cast a ballot, residency points included. */
export const MIN_IDENTITY_SCORE = MINIMUM_VOTING_SCORE;

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

/**
 * Pure decision, given everything already loaded.
 *
 * Residency is judged before identity now, because it is the larger and the
 * likelier gap: a resident who has only signed in holds 40 of the 80 points,
 * and the residency programme is the whole of what they are missing. Telling
 * them to "verify identity" instead would send them to the social-connections
 * page, which cannot get them past 60.
 */
export function decideVoterEligibility(
  user: Pick<User, 'verification_status' | 'identity_score'>,
  activeRun: Pick<VerificationRun, 'completed_check_ins'> | null
): VoterEligibility {
  const residencyVerified = hasVerifiedResidency(user, activeRun);
  const gate = votingGate({
    identityPoints: user.identity_score ?? 0,
    residencyVerified,
  });

  if (gate.canVote) return { eligible: true };

  if (!residencyVerified) {
    return {
      eligible: false,
      code: 'RESIDENCY_NOT_VERIFIED',
      message: `נדרש אימות תושבוּת לפני ההצבעה. יש לכם ${gate.total} מתוך ${gate.required} נקודות.`,
    };
  }
  return {
    eligible: false,
    code: 'IDENTITY_NOT_VERIFIED',
    message: `נדרשות ${gate.required} נקודות אימות כדי להצביע. יש לכם ${gate.total}.`,
  };
}

/** Async shell: loads the active run, then defers to the pure decision. */
export async function checkVoterEligibility(
  user: Pick<User, 'id' | 'verification_status' | 'identity_score'>
): Promise<VoterEligibility> {
  // No short-circuit on the score alone: residency is worth 40 points, so a
  // user under the threshold on paper can still clear it once the run is read.
  const activeRun = await getActiveVerificationRun(user.id);
  return decideVoterEligibility(user, activeRun);
}
