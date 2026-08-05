import 'server-only';

/**
 * The dashboard shell and its figures (Surface 1).
 *
 * This use-case resolves a *membership*, not a scope. Reaching the shell is
 * membership — holding at least one grant in the space — and there is
 * deliberately no twelfth `space.read` capability. Each figure then earns its
 * own `authorize()` call, and a widget the caller has no capability for
 * resolves to `null` rather than failing the page.
 *
 * That is Interaction Contract 1 Rule A implemented server-side: a widget the
 * admin may not see is simply absent from the payload, so the client has
 * nothing to hide and nothing to leak.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { ProposalSummary, SpaceSummary } from '@sync/shared/contracts';
import {
  authorize,
  resolveMembership,
} from '@/server/app/space-admin/authorize';
import { toProposalSummary } from '@/server/app/space-admin/list-proposals';
import { forbidden, type AppError } from '@/server/http/errors';
import { countSpaceMembers } from '@/server/infra/supabase/space-member.repo';
import { countCampaignsSentThisMonth } from '@/server/infra/supabase/space-notify.repo';
import {
  countActiveVotes,
  countProposalsAwaitingDecision,
  findSpaceSummaryByMembership,
  listProposals,
} from '@/server/infra/supabase/space.repo';
import type { Session } from '@/services/auth/session';

/** How many rows the `דורש הכרעה` panel shows before deferring to Surface 2. */
const OVERVIEW_QUEUE_LIMIT = 5;

/**
 * `null` on any figure means the caller holds no capability for it, so the UI
 * renders nothing there — never a zero and never a dash. The capability each
 * figure is gated on is named beside it.
 */
export interface SpaceOverviewFigures {
  /** proposal.read */
  proposalsAwaitingDecision: number | null;
  /** member.read */
  membersInSpace: number | null;
  /** proposal.read — published and open, so it rides with the queue's scope. */
  activeVotes: number | null;
  /** notification.send */
  notificationsSentThisMonth: number | null;
}

export interface SpaceOverview {
  space: SpaceSummary;
  /**
   * The capability manifest. Same array as `space.capabilities`; `space` is a
   * whole `SpaceSummary` so the shell can be validated against the contract,
   * and the manifest reads it from the top level.
   */
  capabilities: SpaceSummary['capabilities'];
  figures: SpaceOverviewFigures;
  recentQueue: ProposalSummary[] | null;
}

interface ProposalWidgets {
  awaitingDecision: number;
  activeVotes: number;
  queue: ProposalSummary[];
}

/**
 * A missing capability is an absent widget, not a failed page. Only FORBIDDEN
 * folds — a DB failure still fails, because a silently empty figure would be
 * indistinguishable from a real zero.
 */
const optional = <T>(result: ResultAsync<T, AppError>): ResultAsync<T | null, AppError> =>
  result.orElse((error) =>
    error.kind === 'FORBIDDEN' ? okAsync<T | null, AppError>(null) : errAsync(error)
  );

/**
 * Both vote figures and the queue ride on one capability and one scope.
 * `הצבעות פעילות` is a read of the same table under the same predicate as
 * `הצעות ממתינות להכרעה`, so splitting it onto a second capability would say
 * that reading this space's votes has two different answers.
 */
const proposalWidgets = (
  session: Session,
  rawSpaceId: string
): ResultAsync<ProposalWidgets | null, AppError> =>
  optional(
    authorize(session, rawSpaceId, 'proposal.read').andThen((scope) =>
      ResultAsync.combine([
        countProposalsAwaitingDecision(scope),
        countActiveVotes(scope),
        listProposals(scope, { status: 'in_review', limit: OVERVIEW_QUEUE_LIMIT }),
      ] as const).map(([awaitingDecision, activeVotes, rows]) => ({
        awaitingDecision,
        activeVotes,
        queue: rows.map((row) => toProposalSummary(row, scope.userId)),
      }))
    )
  );

/** `חברים במרחב` — the count 05-06 exposes, behind its own capability. */
const memberCount = (
  session: Session,
  rawSpaceId: string
): ResultAsync<number | null, AppError> =>
  optional(authorize(session, rawSpaceId, 'member.read').andThen(countSpaceMembers));

/**
 * `התראות שנשלחו החודש` — the same count the composer reads its quota against
 * (05-08), so the overview and the dispatch surface can never disagree.
 */
const notificationCount = (
  session: Session,
  rawSpaceId: string
): ResultAsync<number | null, AppError> =>
  optional(
    authorize(session, rawSpaceId, 'notification.send').andThen(countCampaignsSentThisMonth)
  );

export function getSpaceOverview(
  session: Session,
  rawSpaceId: string
): ResultAsync<SpaceOverview, AppError> {
  return resolveMembership(session, rawSpaceId).andThen((membership) =>
    findSpaceSummaryByMembership(membership).andThen((row) => {
      // A membership resolved but the space row did not: the same opaque
      // denial, because distinguishing it would disclose that the id is real.
      if (row === null) return errAsync<SpaceOverview, AppError>(forbidden());

      const capabilities = [...membership.capabilities];

      // Each figure earns its own authorize(), so a capability the caller lacks
      // costs one denial rather than the page. They are resolved together
      // because they are independent reads with no ordering between them.
      return ResultAsync.combine([
        proposalWidgets(session, rawSpaceId),
        memberCount(session, rawSpaceId),
        notificationCount(session, rawSpaceId),
      ] as const).map(([widgets, membersInSpace, notificationsSentThisMonth]) => ({
        space: {
          id: row.id,
          slug: row.slug,
          nameHe: row.name_he,
          type: row.type,
          /** First 8 chars of the uuid, for the edition meta line. */
          shortId: row.id.slice(0, 8),
          suspended: membership.suspended,
          capabilities,
        },
        capabilities,
        figures: {
          proposalsAwaitingDecision: widgets ? widgets.awaitingDecision : null,
          membersInSpace,
          activeVotes: widgets ? widgets.activeVotes : null,
          notificationsSentThisMonth,
        },
        recentQueue: widgets ? widgets.queue : null,
      }));
    })
  );
}
