import 'server-only';

/**
 * One proposal: the decision, and the detail panel the decision is made
 * against (Surface 2).
 *
 * The decision runs a fixed six-step chain, and the order is the design. Each
 * step exists so the next step's failure is unambiguous: capability first, then
 * the scoped read, then the pure domain guards, then the target, then the
 * conditional transition, then the audit row. Reordering any pair changes which
 * status code a caller sees for a given situation, which is a behaviour change
 * even though nothing in the type system objects.
 */

import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import type {
  DecideProposalRequest,
  ProposalDetail,
  ProposalStatus,
} from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import { toProposalSummary } from '@/server/app/space-admin/list-proposals';
import {
  auditActionFor,
  capabilityFor,
  isDecidableFrom,
  resolveDecisionTarget,
  reviewerMayDecide,
} from '@/server/domain/space/review';
import { conflict, forbidden, paymentInvalid, type AppError } from '@/server/http/errors';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  DECISION_CONFLICT_HE,
  findProposalInScope,
  transitionProposal,
  type ProposalDetailRow,
} from '@/server/infra/supabase/space-decision.repo';
import {
  CREATION_FEE_AGOROT,
  type CreationFeeCharge,
  type CreationFeePort,
} from '@/server/app/space-admin/ports/creation-fee';
import { createCreationFeePort } from '@/server/infra/payments/creation-fee';
import type { Session } from '@/services/auth/session';

/**
 * The one refusal in this module that carries a reason. It discloses nothing
 * the caller does not already know - they are the submitter - and the UI needs
 * the sentence verbatim. Every other denial here stays the constant opaque one,
 * so the rule that a space-admin refusal says nothing is intact.
 */
const SELF_SUBMITTED_HE = 'הצעה שהגשתם - ההכרעה שמורה למנהל אחר.';

/**
 * What the approve dialog renders, verbatim, when the fee request declines.
 *
 * The port's own reason is generic - it does not know it is being called from a
 * review dialog. This sentence is the promise that dialog makes, so the
 * use-case substitutes it on the way out and the 402 body is exactly what the
 * `role="alert"` shows. `אף סכום לא נגבה` is true because the charge precedes
 * the transition: a decline means nothing was published either.
 */
export const CHARGE_FAILED_HE =
  'ההצעה לא פורסמה: החיוב של המגיש/ה נכשל. אף סכום לא נגבה. נסו שוב מאוחר יותר, או החזירו את ההצעה לתיקון.';

/**
 * The decision's collaborators. Only the fee port for now: it is the one
 * dependency a test must be able to fail on demand, because "a declined charge
 * publishes nothing" is not provable against a real payment rail.
 */
export interface DecideProposalDeps {
  creationFee: CreationFeePort;
}

/**
 * A declining charge keeps its 402 and gains the dialog's sentence. Any other
 * failure from the port passes through untouched - a port that reports a
 * database fault should not be dressed up as a payment decline.
 */
const asChargeFailure = (error: AppError): AppError =>
  error.kind === 'PAYMENT_INVALID' ? paymentInvalid(CHARGE_FAILED_HE) : error;

/** The row plus the resolved status, in the response allow-list's shape. */
function toProposalDetail(
  row: ProposalDetailRow,
  viewerId: string,
  statusOverride?: ProposalStatus
): ProposalDetail {
  const summary = toProposalSummary(row, viewerId);
  return {
    ...summary,
    status: statusOverride ?? summary.status,
    body: row.description,
    hiddenAt: row.hidden_at,
    flaggedAt: row.flagged_at,
  };
}

/**
 * What `?proposal={id}` deep-links resolve against.
 *
 * An id that does not resolve inside this space is the same opaque refusal as
 * no grant at all - never a 404, which would confirm that the vote exists
 * somewhere else.
 */
export function getProposalDetail(
  session: Session,
  rawSpaceId: string,
  voteId: string
): ResultAsync<ProposalDetail, AppError> {
  return authorize(session, rawSpaceId, 'proposal.read').andThen((scope) =>
    findProposalInScope(scope, voteId).andThen((row) =>
      row === null
        ? errAsync<ProposalDetail, AppError>(forbidden())
        : okAsync(toProposalDetail(row, scope.userId))
    )
  );
}

export function decideProposal(
  session: Session,
  rawSpaceId: string,
  voteId: string,
  command: DecideProposalRequest,
  /**
   * Defaulted rather than threaded through the route, so the two decide/detail
   * routes keep the same shape as every other thin shell in this phase. A test
   * substitutes a failing port by passing this explicitly, or by mocking
   * `infra/payments/creation-fee`.
   */
  deps: DecideProposalDeps = { creationFee: createCreationFeePort() }
): ResultAsync<ProposalDetail, AppError> {
  // 1. Approving needs proposal.approve; rejecting and returning for changes
  //    need proposal.reject. The capability is derived from the decision, so a
  //    new decision verb cannot silently inherit the wrong one.
  return authorize(session, rawSpaceId, capabilityFor(command.decision)).andThen((scope) =>
    // 2. Read THROUGH the scope. A vote in another space and a vote that does
    //    not exist both read back nothing, and both refuse identically with no
    //    reason attached - the two cases must stay indistinguishable.
    findProposalInScope(scope, voteId).andThen((row) => {
      if (row === null) return errAsync<ProposalDetail, AppError>(forbidden());

      // 3a. Self-review, refused server-side and independently of whether the
      //     UI ever rendered the button.
      if (!reviewerMayDecide({ submitterId: row.creator_id, reviewerId: scope.userId })) {
        return errAsync<ProposalDetail, AppError>(forbidden(SELF_SUBMITTED_HE));
      }

      // 3b. Only a proposal actually under review is decidable. This is the
      //     friendly half of the conflict; step 5 is the authoritative one.
      if (!isDecidableFrom(row.status)) {
        return errAsync<ProposalDetail, AppError>(conflict(DECISION_CONFLICT_HE));
      }

      // 4. Where the decision lands. Approval reuses the publication rule, so a
      //    proposal approved before its start date is scheduled, not opened.
      const now = new Date();
      const next = resolveDecisionTarget(command.decision, new Date(row.start_date), now);

      // 4b. The ₪50 creation fee, on the approve branch only, and BEFORE the
      //     transition. Do not reorder. If the charge ran after publication, a
      //     decline would leave the proposal live and unbilled, and the approve
      //     dialog promises the opposite: אף סכום לא נגבה, nothing published.
      //     The submitter is billed - never the reviewer, who is `scope.userId`
      //     and merely clicked the button.
      //
      //     The visible consequence of charging first: if the transition below
      //     then loses the race, the obligation has already been recorded. That
      //     is why the port's idempotency key is deterministic - a second
      //     approval attempt reuses the same payments row instead of billing
      //     twice. A concurrent *reject* strands that row instead; see the plan
      //     summary, PAY-06 must reconcile stranded pending rows.
      const chargeCmd = {
        submitterUserId: row.creator_id,
        voteId,
        amountAgorot: CREATION_FEE_AGOROT,
      };
      const charge: ResultAsync<CreationFeeCharge | null, AppError> =
        command.decision === 'approve'
          ? deps.creationFee.charge(chargeCmd).mapErr(asChargeFailure)
          : okAsync<CreationFeeCharge | null, AppError>(null);

      return charge
        .andThen((fee) =>
          // 5. The authoritative guard: one UPDATE carrying both the space
          //    predicate and the prior state. Zero rows is the 409.
          transitionProposal(scope, voteId, 'in_review', next).map(() => fee)
        )
        .andThen((fee) =>
          // 6. The audit write is not fire-and-forget. If it fails the whole
          //    decision fails, because SPACE-04 says every decision writes an
          //    immutable row, and a published-but-unaudited vote breaks that.
          //    The payment id rides in `new_state`, so the money and the
          //    decision are linked in the one log that cannot be edited.
          insertAuditRow({
            space_id: scope.spaceId,
            actor_user_id: scope.userId,
            action: auditActionFor(command.decision),
            object_type: 'vote',
            object_id: voteId,
            prior_state: { status: row.status },
            new_state: {
              status: next,
              ...(fee
                ? { paymentId: fee.paymentId, amountAgorot: CREATION_FEE_AGOROT }
                : {}),
            },
            reason: command.reason,
          }).map(() => toProposalDetail(row, scope.userId, next))
        );
    })
  );
}
