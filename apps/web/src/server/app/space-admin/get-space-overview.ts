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
import {
  countProposalsAwaitingDecision,
  findSpaceSummaryByMembership,
  listProposals,
} from '@/server/infra/supabase/space.repo';
import type { Session } from '@/services/auth/session';

/** How many rows the `דורש הכרעה` panel shows before deferring to Surface 2. */
const OVERVIEW_QUEUE_LIMIT = 5;

export interface SpaceOverviewFigures {
  /** null ⇒ the caller holds no proposal.read, so the figure is absent, not zero. */
  proposalsAwaitingDecision: number | null;
  membersInSpace: number | null;
  activeVotes: number | null;
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

const proposalWidgets = (
  session: Session,
  rawSpaceId: string
): ResultAsync<ProposalWidgets | null, AppError> =>
  optional(
    authorize(session, rawSpaceId, 'proposal.read').andThen((scope) =>
      countProposalsAwaitingDecision(scope).andThen((awaitingDecision) =>
        listProposals(scope, { status: 'in_review', limit: OVERVIEW_QUEUE_LIMIT }).map(
          (rows) => ({
            awaitingDecision,
            queue: rows.map((row) => toProposalSummary(row, scope.userId)),
          })
        )
      )
    )
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

      return proposalWidgets(session, rawSpaceId).map((widgets) => ({
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
          // The shape is final now so the UI plan can build against it; the data
          // lands with the plans that own those tables.
          membersInSpace: null, // wired in 05-06
          activeVotes: null, // wired in 05-06
          notificationsSentThisMonth: null, // wired in 05-08
        },
        recentQueue: widgets ? widgets.queue : null,
      }));
    })
  );
}
