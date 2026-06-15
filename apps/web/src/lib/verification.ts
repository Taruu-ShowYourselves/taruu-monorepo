/**
 * Verification eligibility helpers.
 *
 * Single source of truth for "is this user allowed to vote?". The residency
 * program continues to run scheduled check-ins in the background, but the
 * product decision is that the FIRST successful GPS check-in makes the user
 * eligible — so a fully `completed` phase is sufficient but not required.
 *
 * Pure + typed against the shared `UserProfile` so both the verification page
 * and the participation gate (J2) agree on one rule.
 */

import type { UserProfile } from '@sync/shared';

type MaybeUser = Pick<UserProfile, 'verificationStatus'> | null | undefined;

/**
 * True when the user may participate in a vote. Either the full residency
 * program has completed, OR they have logged at least one successful check-in
 * (the first check-in gates voting; further check-ins never block).
 */
export function isEligibleToVote(user: MaybeUser): boolean {
  const status = user?.verificationStatus;
  if (!status) return false;
  return status.phase === 'completed' || (status.checkInsCompleted ?? 0) >= 1;
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
