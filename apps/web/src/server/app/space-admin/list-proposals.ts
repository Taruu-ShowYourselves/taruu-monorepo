import 'server-only';

/**
 * The proposal review queue (Surface 2).
 *
 * The whole authorization story is the first line of the use-case: one
 * `authorize(…, 'proposal.read')` call yields the scope, and the repository
 * refuses to be called without it. There is no second check to forget.
 */

import type { ResultAsync } from 'neverthrow';
import { z } from 'zod';
import {
  ProposalStatusSchema,
  type ProposalListResponse,
  type ProposalSummary,
} from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import { REVIEW_VOTE_STATUSES } from '@/server/domain/space/review';
import type { AppError } from '@/server/http/errors';
import {
  listProposals,
  type ProposalFilter,
  type ProposalRow,
} from '@/server/infra/supabase/space.repo';
import type { Session } from '@/services/auth/session';

/**
 * The five filter chips on Surface 2: the four review states plus `אושרו`,
 * which is the published `active` row. Derived from the domain vocabulary so a
 * new review state cannot be filterable here without being reviewable there.
 */
export const PROPOSAL_FILTER_STATUSES = [...REVIEW_VOTE_STATUSES, 'active'] as const;

export const ProposalListQuerySchema = z.object({
  status: z.enum(PROPOSAL_FILTER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
});

export type ProposalListQuery = z.infer<typeof ProposalListQuerySchema>;

/** Hebrew-only product, so an unnamed submitter still needs a Hebrew label. */
const SUBMITTER_FALLBACK_HE = 'תושב/ת';

const displayName = (first: string | null, last: string | null): string =>
  [first, last].filter((part): part is string => Boolean(part && part.trim())).join(' ') ||
  SUBMITTER_FALLBACK_HE;

/**
 * `selfSubmitted` is resolved on the server against the scope's own user id.
 * The UI renders `הצעה שהגשתם — ההכרעה שמורה למנהל אחר.` in place of the
 * decision buttons, and the server independently refuses the decision — the
 * flag is a courtesy to the client, never the control.
 */
export function toProposalSummary(row: ProposalRow, viewerId: string): ProposalSummary {
  return {
    id: row.id,
    title: row.title,
    // Runtime-total rather than a cast: the query only ever admits the review
    // statuses plus `active`, all of which the schema names.
    status: ProposalStatusSchema.catch('draft').parse(row.status),
    submitterId: row.creator_id,
    submitterDisplayName: displayName(row.submitter_first_name, row.submitter_last_name),
    submittedAt: row.created_at,
    hidden: row.hidden_at !== null,
    flagged: row.flagged_at !== null,
    selfSubmitted: row.creator_id === viewerId,
  };
}

export function listSpaceProposals(
  session: Session,
  rawSpaceId: string,
  filter: ProposalFilter
): ResultAsync<ProposalListResponse, AppError> {
  return authorize(session, rawSpaceId, 'proposal.read').andThen((scope) =>
    listProposals(scope, filter).map((rows) => ({
      proposals: rows.map((row) => toProposalSummary(row, scope.userId)),
    }))
  );
}
