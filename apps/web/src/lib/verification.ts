/**
 * Verification eligibility helpers.
 *
 * Single source of truth for "is this user allowed to vote?". The residency
 * program continues to run scheduled check-ins in the background, but the
 * product decision is that the FIRST successful GPS check-in makes the user
 * eligible - so a fully `completed` phase is sufficient but not required.
 *
 * Pure + typed against the shared `UserProfile` so both the verification page
 * and the participation gate (J2) agree on one rule.
 */

import { votingGate, type UserProfile, type VotingGate } from '@sync/shared';

type MaybeUser = Pick<UserProfile, 'verificationStatus'> | null | undefined;

/**
 * True when residency is evidenced. Either the full residency program has
 * completed, OR at least one successful check-in has been logged (the first
 * check-in counts; further check-ins never block).
 *
 * Named for what it establishes rather than what it permits: residency is an
 * explicit hard requirement of the ballot (issue #71 ruling) - its points
 * already live inside the stored identity score, and no other evidence can
 * substitute for it. `voterGate` is the question the UI asks.
 */
export function hasVerifiedResidency(user: MaybeUser): boolean {
  const status = user?.verificationStatus;
  if (!status) return false;
  return status.phase === 'completed' || (status.checkInsCompleted ?? 0) >= 1;
}

/** @deprecated Residency alone no longer opens the ballot - use {@link voterGate}. */
export const isEligibleToVote = hasVerifiedResidency;

/**
 * What the reader still owes the ballot box, scored the way the server scores
 * it (`services/verification/eligibility.ts`). The client never decides
 * anything with this - the server is still the only authority - it decides what
 * to *say*, and how many points to print.
 */
export function voterGate(
  user: (Pick<UserProfile, 'identityScore'> & MaybeUser) | null | undefined
): VotingGate {
  return votingGate({
    identityPoints: user?.identityScore?.total ?? 0,
    residencyVerified: hasVerifiedResidency(user),
  });
}

/**
 * True when the user's phone (identity factor) has been verified. The
 * `UserProfile` type does not carry a dedicated flag, so we treat the presence
 * of a stored phone number as the signal (the verify endpoint only persists
 * `phone` after a successful OTP check).
 */
export function phoneVerified(user: (Pick<UserProfile, 'phone'> & MaybeUser) | null | undefined): boolean {
  return Boolean(user?.phone);
}
