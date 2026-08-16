/**
 * Server-side voter eligibility - the enforcement point.
 *
 * `apps/web/src/lib/verification.ts` (`voterGate`) is what the CLIENT shows:
 * residency is met by a completed program OR at least one successful check-in.
 * A client-side gate is not a gate, so the server applies the same rule from
 * database state: identity_score >= 40 (the Google baseline) AND explicitly
 * verified residency (issue #71 ruling).
 *
 * Residency is load-bearing rather than advisory - it is a hard boolean
 * requirement, never a point substitute. The GPS +20 stays in the stored
 * score for identity/trust display, but it is not what opens the ballot: one
 * ballot per real resident of the municipality, with the residency check
 * evidencing the "of the municipality" part directly.
 */

import { MINIMUM_IDENTITY_SCORE_FOR_VOTING, votingGate } from '@sync/shared';
import type { User, VerificationRun } from '@/lib/supabase/types';
import { getActiveVerificationRun } from '@/lib/supabase/db';

/** Score floor for a ballot; verified residency is required separately. */
export const MIN_IDENTITY_SCORE = MINIMUM_IDENTITY_SCORE_FOR_VOTING;

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
 * Issue #71 ruling: eligibility = identity_score >= 40 AND explicitly
 * verified residency. The stored score already contains the GPS points and
 * the gate adds nothing on top; residency is reported first because it is the
 * hard, non-substitutable requirement - phone, socials or an approved
 * identity document can lift the score, but never stand in for living here.
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
  // The active run is loaded even for low scores: residency is evidenced by a
  // completed programme OR a first successful check-in, and only the run
  // carries the check-in count.
  const activeRun = await getActiveVerificationRun(user.id);
  return decideVoterEligibility(user, activeRun);
}
