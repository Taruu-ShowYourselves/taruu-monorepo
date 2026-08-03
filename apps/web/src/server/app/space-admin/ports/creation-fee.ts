import 'server-only';

/**
 * The seam between the review decision and whatever payment rail exists.
 *
 * The locked product decision (05-CONTEXT.md) is that the ₪50 creation fee is
 * charged when a proposal is approved, not when it is submitted. The
 * card-on-file rail that can actually capture money off-session is phase 3
 * (PAY-06) and has not shipped. So approval calls this port; today's
 * implementation records a deterministic pending obligation against the
 * submitter, and when PAY-06 lands its token charge replaces the
 * implementation without decide-proposal.ts changing at all.
 *
 * The port is an interface rather than a function so the decision use-case can
 * take it through `deps` and a test can substitute a failing one — a charge
 * that declines is a behaviour this surface has to get right, and it must be
 * reachable without a payment provider.
 */

import type { ResultAsync } from 'neverthrow';
import type { AppError } from '@/server/http/errors';

/**
 * ₪50 in agorot. `CREATE_VOTE_COST = 50` in @sync/shared is the same amount in
 * shekels; `payments.amount` is an INTEGER of agorot, so the two differ by
 * 100 and must not be interchanged.
 */
export const CREATION_FEE_AGOROT = 5000;

export interface CreationFeeCharge {
  paymentId: string;
  /** 'captured' once PAY-06 lands; 'obligation' with today's rails. */
  outcome: 'captured' | 'obligation';
}

export interface CreationFeePort {
  charge(cmd: {
    submitterUserId: string;
    voteId: string;
    amountAgorot: number;
  }): ResultAsync<CreationFeeCharge, AppError>;
}
