import 'server-only';

/**
 * People and permitted-content data access for one space.
 *
 * Same contract as `space.repo.ts`: every query runs as the Supabase service
 * role, which has BYPASSRLS, so the space predicate is written here and by
 * nothing else. Every exported function takes a `SpaceScope` as parameter one
 * - except `suspendGrantById` and `insertEscalation`, which are reachable
 * without a space capability and say so at their own definitions, and
 * `isPlatformAdmin`, which is a plain user lookup with no space in it at all.
 *
 * Two absolute rules hold across this module:
 *
 * 1. **Nothing is ever removed.** Revoking a capability, suspending a member
 *    and unhiding content are all writes that set or clear a nullable column.
 *    A row deleted here would erase the fact that the authority once existed,
 *    which is precisely what SPACE-09 forbids.
 *
 * 2. **Every mutation is conditional.** The space predicate and the
 *    current-state guard travel in the same statement as the write, so two
 *    concurrent admins cannot both "win" the same transition and a no-op is
 *    reported as a conflict rather than swallowed.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { UpdateTables } from '@/lib/supabase/types';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import type { Capability } from '@/server/domain/space/capability';
import { conflict, dbError, type AppError } from '@/server/http/errors';

/** The four permitted-content transitions, mirroring `ContentActionSchema`. */
export type ContentModerationAction = 'hide' | 'unhide' | 'flag' | 'unflag';

/**
 * The member projection. Exactly the seven columns the members surface is
 * allowed to read, and no more.
 *
 * `identity_verified_at` is read only so the use-case can turn it into a
 * boolean. It must never leave the server as a timestamp: *when* someone was
 * verified is more than administration needs, and it is one join away from the
 * document that verified them.
 */
export interface MemberRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  municipality_id: string | null;
  verification_status: 'none' | 'pending' | 'verified' | 'failed';
  identity_verified_at: string | null;
  created_at: string;
}

export interface MemberFilter {
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface MemberGrantRow {
  user_id: string;
  capability: Capability;
}

export interface MemberSuspensionRef {
  user_id: string;
}

export interface GrantRecord {
  id: string;
  user_id: string;
  capability: Capability;
  granted_via_role: string | null;
}

export interface MemberSuspensionRecord {
  id: string;
  suspended_at: string;
}

export interface ModeratedContentRow {
  id: string;
  hidden_at: string | null;
  flagged_at: string | null;
}

export interface EscalationRecord {
  id: string;
  created_at: string;
}

/** Hard ceiling on one member page, independent of what the caller asks for. */
export const MEMBER_PAGE_MAX = 200;
const MEMBER_PAGE_DEFAULT = 50;

/**
 * PostgREST parses `or=(…)` as a comma-separated list, so a comma or a bracket
 * inside a user-supplied term would change the shape of the filter rather than
 * the value being matched. Strip them before interpolation.
 */
const sanitizeSearch = (term: string): string => term.replace(/[,().*%\\]/g, '').trim();

const isUniqueViolation = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'code' in cause &&
  (cause as { code?: unknown }).code === '23505';

/**
 * A unique-index collision here is not a server fault - it means the state the
 * caller asked for already exists. Surfacing it as a 500 would tell an admin
 * their action broke when in fact it was already done.
 */
const uniqueAware =
  (op: string, reasonHe: string) =>
  (cause: unknown): AppError =>
    isUniqueViolation(cause) ? conflict(reasonHe) : dbError(op, cause);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Members of a space are the residents whose `users.municipality_id` equals the
 * space's resolved `municipality_code`.
 *
 * The column list below is hand-written on purpose. A star select on users in
 * an admin surface guarantees a future privacy leak - the next private column
 * added to the table would join the response with nobody deciding it should -
 * and the identity-document table is never joined from this module at all. The
 * permitted seven are the ones `SpaceMemberSchema` can express; widening them
 * is a privacy decision made in the contract, not here.
 */
export function listSpaceMembers(
  scope: SpaceScope,
  filter: MemberFilter
): ResultAsync<MemberRow[], AppError> {
  let builder = supabaseAdmin
    .from('users')
    // Kept on one line, over the house column width, so the allow-list is one
    // greppable string rather than something a reviewer has to reassemble.
    .select('id, first_name, last_name, municipality_id, verification_status, identity_verified_at, created_at')
    .eq('municipality_id', scope.municipalityCode); // scope key, never a caller string

  const term = filter.search ? sanitizeSearch(filter.search) : '';
  if (term) {
    builder = builder.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*`);
  }

  // Keyset on the same key the list is ordered by, so an insertion between
  // pages cannot duplicate or skip a member.
  if (filter.cursor) builder = builder.lt('created_at', filter.cursor);

  const query = builder
    .order('created_at', { ascending: false })
    .limit(Math.min(filter.limit ?? MEMBER_PAGE_DEFAULT, MEMBER_PAGE_MAX))
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('users.listSpaceMembers', cause));
}

/** The `{n} חברים במרחב` total. Counted in SQL, never from the fetched page. */
export function countSpaceMembers(scope: SpaceScope): ResultAsync<number, AppError> {
  const query = supabaseAdmin
    .from('users')
    .select('id', { head: true, count: 'exact' })
    .eq('municipality_id', scope.municipalityCode)
    .then(({ count, error }) => {
      if (error) throw error;
      return count ?? 0;
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('users.countSpaceMembers', cause));
}

/**
 * Batched by design: one query for the whole page. Resolving a member's
 * capabilities row by row would put an N+1 behind a table that renders fifty
 * rows at a time.
 */
export function listGrantsForSpace(
  scope: SpaceScope,
  userIds: readonly string[]
): ResultAsync<MemberGrantRow[], AppError> {
  if (userIds.length === 0) return okAsync([]);

  const query = supabaseAdmin
    .from('space_capability_grants')
    .select('user_id, capability')
    .eq('space_id', scope.spaceId)
    .in('user_id', [...userIds])
    .is('suspended_at', null)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as MemberGrantRow[];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_capability_grants.listForSpace', cause)
  );
}

/** Batched for the same reason. Only unlifted suspensions count as active. */
export function listActiveMemberSuspensions(
  scope: SpaceScope,
  userIds: readonly string[]
): ResultAsync<MemberSuspensionRef[], AppError> {
  if (userIds.length === 0) return okAsync([]);

  const query = supabaseAdmin
    .from('space_member_suspensions')
    .select('user_id')
    .eq('space_id', scope.spaceId)
    .in('user_id', [...userIds])
    .is('lifted_at', null)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as MemberSuspensionRef[];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_member_suspensions.listActive', cause)
  );
}

/**
 * A plain user lookup - no space, and therefore no `SpaceScope`. The platform
 * admin marker is deliberately not a space capability and confers no data
 * access on its own; it authorizes exactly one action, in `manage-grants.ts`.
 */
export function isPlatformAdmin(userId: string): ResultAsync<boolean, AppError> {
  const query = supabaseAdmin
    .from('users')
    .select('is_platform_admin')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return Boolean((data as { is_platform_admin?: boolean } | null)?.is_platform_admin);
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('users.isPlatformAdmin', cause));
}

// ---------------------------------------------------------------------------
// Grant mutations
// ---------------------------------------------------------------------------

export function insertGrant(
  scope: SpaceScope,
  input: { userId: string; capability: Capability; grantedViaRole?: string | null }
): ResultAsync<GrantRecord, AppError> {
  const query = supabaseAdmin
    .from('space_capability_grants')
    .insert({
      space_id: scope.spaceId,
      user_id: input.userId,
      capability: input.capability,
      granted_via_role: input.grantedViaRole ?? null,
      granted_by: scope.userId,
    })
    .select('id, user_id, capability, granted_via_role')
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data as GrantRecord;
    });

  // Idempotency is the database's job: uq_active_grant already forbids a second
  // active row for the same (space, user, capability), so the insert races
  // correctly without a read-then-write.
  return ResultAsync.fromPromise(
    query,
    uniqueAware('space_capability_grants.insert', 'ההרשאה כבר קיימת.')
  );
}

/**
 * Revocation is a suspension write, never a deletion: removing the row would
 * erase the fact that the capability was once held, and the audit log's
 * `ON DELETE RESTRICT` exists to make that impossible anyway.
 *
 * The space predicate and the "still active" guard are in the same statement as
 * the write, so a second concurrent revoke matches zero rows and is reported.
 */
export function revokeGrant(
  scope: SpaceScope,
  input: { userId: string; capability: Capability }
): ResultAsync<GrantRecord, AppError> {
  const query = supabaseAdmin
    .from('space_capability_grants')
    .update({ suspended_at: new Date().toISOString(), suspended_by: scope.userId })
    .eq('space_id', scope.spaceId) // scope key, never a caller string
    .eq('user_id', input.userId)
    .eq('capability', input.capability)
    .is('suspended_at', null) // current-state guard, same statement
    .select('id, user_id, capability, granted_via_role')
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = (data ?? []) as GrantRecord[];
      if (rows.length === 0) return null;
      return rows[0];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_capability_grants.revoke', cause)
  ).andThen((row) =>
    row === null
      ? errAsync<GrantRecord, AppError>(conflict('ההרשאה כבר אינה פעילה.'))
      : okAsync(row)
  );
}

/**
 * The platform-admin path, and the reason it takes plain ids rather than a
 * `SpaceScope`: a platform admin holds no capability in the target space, so
 * there is no grant from which a scope could be minted, and minting one for
 * them would manufacture exactly the cross-space wildcard the phase rejected.
 * The `is_platform_admin` check therefore lives in the calling use-case, which
 * is the only caller allowed to reach this function.
 */
export function suspendGrantById(
  spaceId: string,
  grantId: string,
  actorUserId: string
): ResultAsync<GrantRecord, AppError> {
  const query = supabaseAdmin
    .from('space_capability_grants')
    .update({ suspended_at: new Date().toISOString(), suspended_by: actorUserId })
    .eq('id', grantId)
    .eq('space_id', spaceId)
    .is('suspended_at', null)
    .select('id, user_id, capability, granted_via_role')
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = (data ?? []) as GrantRecord[];
      return rows.length === 0 ? null : rows[0];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_capability_grants.suspendById', cause)
  ).andThen((row) =>
    row === null
      ? errAsync<GrantRecord, AppError>(conflict('ההרשאה כבר אינה פעילה.'))
      : okAsync(row)
  );
}

// ---------------------------------------------------------------------------
// Member suspension
// ---------------------------------------------------------------------------

/**
 * Named apart from the `suspendMember` use-case on purpose - the same reason
 * `listSpaceMembers` and `getSpaceMembers` differ. One name across the app and
 * infra layers is how a caller reaches the database without an authorization
 * call in front of it.
 *
 * Two statements, and the order is the safety property. PostgREST gives us no
 * transaction, so the grants are suspended **first**: if the second write then
 * fails, access is already gone and no suspension record exists - the failure
 * direction is closed, never open. Both writes carry the identical timestamp,
 * which is what lets a later reinstatement restore exactly the grants this
 * suspension took and leave a separately-revoked grant revoked.
 */
export function insertMemberSuspension(
  scope: SpaceScope,
  input: { userId: string; reason: string }
): ResultAsync<MemberSuspensionRecord, AppError> {
  const suspendedAt = new Date().toISOString();

  const grants = supabaseAdmin
    .from('space_capability_grants')
    .update({ suspended_at: suspendedAt, suspended_by: scope.userId })
    .eq('space_id', scope.spaceId)
    .eq('user_id', input.userId)
    .is('suspended_at', null)
    .select('id')
    .then(({ error }) => {
      if (error) throw error;
      return true;
    });

  return ResultAsync.fromPromise(grants, (cause) =>
    dbError('space_capability_grants.suspendForMember', cause)
  ).andThen(() => {
    const record = supabaseAdmin
      .from('space_member_suspensions')
      .insert({
        space_id: scope.spaceId,
        user_id: input.userId,
        suspended_at: suspendedAt,
        suspended_by: scope.userId,
        reason: input.reason,
      })
      .select('id, suspended_at')
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return data as MemberSuspensionRecord;
      });

    return ResultAsync.fromPromise(
      record,
      uniqueAware('space_member_suspensions.insert', 'החבר/ה כבר מושעה/ית במרחב הזה.')
    );
  });
}

/**
 * Lift the suspension record first, then restore the grants it took.
 *
 * The grant restore matches on the suspension's own timestamp rather than on
 * "every suspended grant of this member". A capability revoked individually
 * before the suspension must stay revoked - the confirmation copy promises the
 * permissions held *before* the suspension, and a revoked one was not among
 * them.
 */
export function liftMemberSuspension(
  scope: SpaceScope,
  input: { userId: string }
): ResultAsync<MemberSuspensionRecord, AppError> {
  const lift = supabaseAdmin
    .from('space_member_suspensions')
    .update({ lifted_at: new Date().toISOString(), lifted_by: scope.userId })
    .eq('space_id', scope.spaceId)
    .eq('user_id', input.userId)
    .is('lifted_at', null) // current-state guard, same statement
    .select('id, suspended_at')
    .then(({ data, error }) => {
      if (error) throw error;
      const rows = (data ?? []) as MemberSuspensionRecord[];
      return rows.length === 0 ? null : rows[0];
    });

  return ResultAsync.fromPromise(lift, (cause) =>
    dbError('space_member_suspensions.lift', cause)
  )
    .andThen((row) =>
      row === null
        ? errAsync<MemberSuspensionRecord, AppError>(
            conflict('החבר/ה אינו מושעה/ית במרחב הזה.')
          )
        : okAsync(row)
    )
    .andThen((row) => {
      const restore = supabaseAdmin
        .from('space_capability_grants')
        .update({ suspended_at: null, suspended_by: null })
        .eq('space_id', scope.spaceId)
        .eq('user_id', input.userId)
        .eq('suspended_at', row.suspended_at)
        .select('id')
        .then(({ error }) => {
          if (error) throw error;
          return row;
        });

      return ResultAsync.fromPromise(
        restore,
        uniqueAware(
          'space_capability_grants.restoreForMember',
          'לחבר/ה כבר קיימת הרשאה פעילה זהה.'
        )
      );
    });
}

// ---------------------------------------------------------------------------
// Permitted content
// ---------------------------------------------------------------------------

const CONTENT_CONFLICTS_HE: Record<ContentModerationAction, string> = {
  hide: 'התוכן כבר מוסתר.',
  unhide: 'התוכן אינו מוסתר.',
  flag: 'התוכן כבר מסומן לבדיקה.',
  unflag: 'התוכן אינו מסומן לבדיקה.',
};

const contentPatch = (
  action: ContentModerationAction,
  now: string,
  actorUserId: string
): UpdateTables<'votes'> => {
  switch (action) {
    case 'hide':
      return { hidden_at: now, hidden_by: actorUserId };
    case 'unhide':
      return { hidden_at: null, hidden_by: null };
    case 'flag':
      return { flagged_at: now, flagged_by: actorUserId };
    case 'unflag':
      return { flagged_at: null, flagged_by: null };
  }
};

/**
 * One conditional update per action, each carrying the space predicate and the
 * current-state guard alongside the write. Hiding something already hidden
 * matches zero rows and is a conflict, not a silent success - an admin told
 * "done" when nothing changed cannot tell their action from a race.
 */
export function setContentModeration(
  scope: SpaceScope,
  voteId: string,
  action: ContentModerationAction
): ResultAsync<ModeratedContentRow, AppError> {
  const column = action === 'hide' || action === 'unhide' ? 'hidden_at' : 'flagged_at';
  const setting = action === 'hide' || action === 'flag';

  const base = supabaseAdmin
    .from('votes')
    .update(contentPatch(action, new Date().toISOString(), scope.userId))
    .eq('id', voteId)
    .eq('municipality_id', scope.municipalityCode); // scope key, never a caller string

  const guarded = setting ? base.is(column, null) : base.not(column, 'is', null);

  const query = guarded.select('id, hidden_at, flagged_at').then(({ data, error }) => {
    if (error) throw error;
    const rows = (data ?? []) as ModeratedContentRow[];
    return rows.length === 0 ? null : rows[0];
  });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('votes.setContentModeration', cause)
  ).andThen((row) =>
    row === null
      ? errAsync<ModeratedContentRow, AppError>(conflict(CONTENT_CONFLICTS_HE[action]))
      : okAsync(row)
  );
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

/**
 * Plain values rather than a `SpaceScope`, because the escalation path is
 * reachable by a suspended admin and by a user holding nothing at all - there
 * is no capability from which a scope could be minted, and requiring one would
 * put the control out of reach of exactly the people who need it.
 *
 * This function performs no lookup of its own and contains no branch that
 * depends on whether the named space exists. `spaceId` is whatever the caller's
 * membership resolved to, or null when it did not resolve; `rawSpaceId` always
 * carries exactly what was sent. `platform_escalations.space_id` is nullable
 * against a non-null `raw_space_id` for this reason: the insert succeeds
 * identically for a real space, a foreign one, an unknown uuid and a malformed
 * string, so the endpoint above it cannot become an existence oracle.
 */
export function insertEscalation(input: {
  spaceId: string | null;
  rawSpaceId: string;
  raisedBy: string;
  body: string;
}): ResultAsync<EscalationRecord, AppError> {
  const query = supabaseAdmin
    .from('platform_escalations')
    .insert({
      space_id: input.spaceId,
      raw_space_id: input.rawSpaceId,
      raised_by: input.raisedBy,
      body: input.body,
    })
    .select('id, created_at')
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data as EscalationRecord;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('platform_escalations.insert', cause)
  );
}
