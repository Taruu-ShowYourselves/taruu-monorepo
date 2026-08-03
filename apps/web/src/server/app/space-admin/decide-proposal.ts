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
import { conflict, forbidden, type AppError } from '@/server/http/errors';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  DECISION_CONFLICT_HE,
  findProposalInScope,
  transitionProposal,
  type ProposalDetailRow,
} from '@/server/infra/supabase/space-decision.repo';
import type { Session } from '@/services/auth/session';

/**
 * The one refusal in this module that carries a reason. It discloses nothing
 * the caller does not already know — they are the submitter — and the UI needs
 * the sentence verbatim. Every other denial here stays the constant opaque one,
 * so the rule that a space-admin refusal says nothing is intact.
 */
const SELF_SUBMITTED_HE = 'הצעה שהגשתם — ההכרעה שמורה למנהל אחר.';

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
 * no grant at all — never a 404, which would confirm that the vote exists
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
  command: DecideProposalRequest
): ResultAsync<ProposalDetail, AppError> {
  // 1. Approving needs proposal.approve; rejecting and returning for changes
  //    need proposal.reject. The capability is derived from the decision, so a
  //    new decision verb cannot silently inherit the wrong one.
  return authorize(session, rawSpaceId, capabilityFor(command.decision)).andThen((scope) =>
    // 2. Read THROUGH the scope. A vote in another space and a vote that does
    //    not exist both read back nothing, and both refuse identically with no
    //    reason attached — the two cases must stay indistinguishable.
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

      // 05-10 inserts the creation-fee charge here, ahead of the transition, so an
      // approval either charges and publishes or does neither. Do not reorder.

      // 5. The authoritative guard: one UPDATE carrying both the space
      //    predicate and the prior state. Zero rows is the 409.
      return transitionProposal(scope, voteId, 'in_review', next).andThen(() =>
        // 6. The audit write is not fire-and-forget. If it fails the whole
        //    decision fails, because SPACE-04 says every decision writes an
        //    immutable row, and a published-but-unaudited vote breaks that.
        insertAuditRow({
          space_id: scope.spaceId,
          actor_user_id: scope.userId,
          action: auditActionFor(command.decision),
          object_type: 'vote',
          object_id: voteId,
          prior_state: { status: row.status },
          new_state: { status: next },
          reason: command.reason,
        }).map(() => toProposalDetail(row, scope.userId, next))
      );
    })
  );
}
