import 'server-only';

/**
 * Space data access — the layer the branded SpaceScope protects.
 *
 * Every query here runs as the Supabase service role, which has BYPASSRLS, so
 * the space predicate is written by this file into the SQL and by nothing else.
 * That is why all but two functions take a `SpaceScope` (or a `SpaceMembership`)
 * as parameter one rather than a `spaceId: string`: a caller-supplied id has no
 * type that fits.
 *
 * `findActiveGrant` and `findGrantsForUser` are the two deliberate exceptions —
 * they are what *produces* a scope, so they necessarily take raw ids. They are
 * called from `server/app/space-admin/authorize.ts` and must not be called
 * anywhere else.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { SpaceMembership, SpaceScope } from '@/server/app/space-admin/authorize';
import type { Capability } from '@/server/domain/space/capability';
import { REVIEW_VOTE_STATUSES, type ReviewVoteStatus } from '@/server/domain/space/review';
import { dbError, type AppError } from '@/server/http/errors';

/** The grant resolver's projection: the space id plus its resolved scoping key. */
export interface ActiveGrantRow {
  space_id: string;
  municipality_code: string | null;
}

/** Every grant row a user holds in one space, suspended ones included. */
export interface UserGrantRow extends ActiveGrantRow {
  capability: Capability;
  suspended_at: string | null;
}

export interface SpaceRow {
  id: string;
  slug: string;
  name_he: string;
  type: string;
  municipality_code: string | null;
  notification_monthly_quota: number;
}

export interface ProposalRow {
  id: string;
  title: string;
  description: string;
  status: string;
  creator_id: string;
  created_at: string;
  hidden_at: string | null;
  flagged_at: string | null;
  submitter_first_name: string | null;
  submitter_last_name: string | null;
}

export interface ProposalFilter {
  status?: ReviewVoteStatus | 'active';
  limit?: number;
  cursor?: string;
}

type EmbeddedSpace = { spaces: { municipality_code: string | null } };
type EmbeddedUser = { users: { first_name: string | null; last_name: string | null } | null };

/**
 * SCOPE PRODUCER — may take raw ids. Backed by
 * `idx_grant_resolver (user_id, space_id, capability) WHERE suspended_at IS NULL`.
 */
export function findActiveGrant(
  userId: string,
  spaceId: string,
  capability: Capability
): ResultAsync<ActiveGrantRow | null, AppError> {
  const query = supabaseAdmin
    .from('space_capability_grants')
    .select('space_id, spaces!inner(municipality_code)')
    .eq('user_id', userId)
    .eq('space_id', spaceId)
    .eq('capability', capability)
    .is('suspended_at', null) // SPACE-09: suspension is immediate; nothing is cached
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as { space_id: string } & EmbeddedSpace;
      return {
        space_id: row.space_id,
        municipality_code: row.spaces.municipality_code,
      };
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_capability_grants.findActive', cause)
  );
}

/**
 * SCOPE PRODUCER — may take raw ids. Reads suspended rows too, because a
 * suspended admin must still reach the shell to see the banner and escalate.
 */
export function findGrantsForUser(
  userId: string,
  spaceId: string
): ResultAsync<UserGrantRow[], AppError> {
  const query = supabaseAdmin
    .from('space_capability_grants')
    .select('space_id, capability, suspended_at, spaces!inner(municipality_code)')
    .eq('user_id', userId)
    .eq('space_id', spaceId)
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<
        { space_id: string; capability: Capability; suspended_at: string | null } & EmbeddedSpace
      >;
      return rows.map((row) => ({
        space_id: row.space_id,
        capability: row.capability,
        suspended_at: row.suspended_at,
        municipality_code: row.spaces.municipality_code,
      }));
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_capability_grants.findForUser', cause)
  );
}

/**
 * Two public entry points, one query. A membership is a weaker token than a
 * scope — it renders the shell and nothing else — so it gets its own signature
 * rather than a cast to SpaceScope, which would let shell-level authority
 * reach a data-layer function that requires a capability.
 *
 * Module-private and therefore NOT exported: a caller-supplied string cannot
 * reach the data layer through it. The column list is hand-written and lives
 * here once; a star select would let a future private column join a response.
 */
const selectSpaceRow = (spaceId: string): ResultAsync<SpaceRow | null, AppError> => {
  const query = supabaseAdmin
    .from('spaces')
    .select('id, slug, name_he, type, municipality_code, notification_monthly_quota')
    .eq('id', spaceId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return (data as SpaceRow | null) ?? null;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('spaces.findSummary', cause));
};

export const findSpaceSummary = (scope: SpaceScope) => selectSpaceRow(scope.spaceId);

export const findSpaceSummaryByMembership = (m: SpaceMembership) =>
  selectSpaceRow(m.spaceId);

/**
 * The review queue. `filter` deliberately has no space field — the only space
 * predicate is the one read off the scope, and it is in the SQL rather than
 * applied after the fetch.
 *
 * The single `.eq()` form is why the scope carries the resolved
 * `municipality_code` and not only the space id: PostgREST cannot express the
 * subquery form.
 */
export function listProposals(
  scope: SpaceScope,
  filter: ProposalFilter
): ResultAsync<ProposalRow[], AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select(
      'id, title, description, status, creator_id, created_at, hidden_at, flagged_at, users(first_name, last_name)'
    )
    .eq('municipality_id', scope.municipalityCode) // scope key, never a caller string — non-nullable by construction, so no cast
    .in('status', filter.status ? [filter.status] : [...REVIEW_VOTE_STATUSES])
    .order('created_at', { ascending: false })
    .limit(Math.min(filter.limit ?? 50, 200))
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<
        Omit<ProposalRow, 'submitter_first_name' | 'submitter_last_name'> & EmbeddedUser
      >;
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        creator_id: row.creator_id,
        created_at: row.created_at,
        hidden_at: row.hidden_at,
        flagged_at: row.flagged_at,
        submitter_first_name: row.users?.first_name ?? null,
        submitter_last_name: row.users?.last_name ?? null,
      }));
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('votes.listProposals', cause));
}

/** The overview's `הצעות ממתינות להכרעה` figure. */
export function countProposalsAwaitingDecision(
  scope: SpaceScope
): ResultAsync<number, AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select('id', { head: true, count: 'exact' })
    .eq('municipality_id', scope.municipalityCode)
    .eq('status', 'in_review')
    .then(({ count, error }) => {
      if (error) throw error;
      return count ?? 0;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('votes.countAwaitingDecision', cause)
  );
}

/**
 * The overview's `הצבעות פעילות` figure: proposals this space already
 * published and that residents can still vote on.
 *
 * `active` is the published-and-open status, distinct from `pending`
 * (approved but scheduled to start later) — see `initialStatus` in
 * server/domain/votes/vote.ts, which is what an approval resolves through.
 * Counting both would report votes nobody can cast yet as open.
 */
export function countActiveVotes(scope: SpaceScope): ResultAsync<number, AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select('id', { head: true, count: 'exact' })
    .eq('municipality_id', scope.municipalityCode) // scope key, never a caller string
    .eq('status', 'active')
    .then(({ count, error }) => {
      if (error) throw error;
      return count ?? 0;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('votes.countActive', cause));
}
