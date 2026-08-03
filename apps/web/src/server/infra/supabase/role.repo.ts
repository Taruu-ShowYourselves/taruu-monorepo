/**
 * Role repository - Result-typed access to role_grants,
 * community_manager_applications and role_grant_events.
 *
 * All reads and writes go through the service-role client, which bypasses RLS
 * by design. Authorization is enforced by `@/server/app/authz/require-role`,
 * never by an RLS policy. The policies added in 05-02 are a defence-in-depth
 * backstop against the anon key and against a future user-scoped read, proven
 * by the harness in 05-04; migrating these reads onto `createUserScopedClient()`
 * is Phase 7 (MIG-01..04), not this phase.
 */

import { ResultAsync } from 'neverthrow';
import type {
  AuditSubjectType,
  RoleGrantStatus,
  RoleName,
} from '@sync/shared/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  CommunityManagerApplication,
  InsertTables,
  RoleGrant,
  RoleGrantEvent,
} from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

// === Grants ==============================================================

/** The caller's live grant (active OR suspended) for one (user, role, space). */
export function findLiveGrant(
  userId: string,
  role: RoleName,
  spaceId: string | null
): ResultAsync<RoleGrant | null, AppError> {
  const base = supabaseAdmin
    .from('role_grants')
    .select('*')
    .eq('user_id', userId)
    .eq('role', role);

  // A platform-wide grant carries space_id NULL, and `.eq(col, null)` does not
  // match NULL in PostgREST - it has to be `.is(col, null)`.
  const scoped = spaceId === null ? base.is('space_id', null) : base.eq('space_id', spaceId);

  const query = scoped
    .in('status', ['active', 'suspended'])
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grants.findLiveGrant', cause)
  );
}

/** Every ACTIVE grant a user holds. Used for reviewer scope and UI gating. */
export function listActiveGrants(userId: string): ResultAsync<RoleGrant[], AppError> {
  const query = supabaseAdmin
    .from('role_grants')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('granted_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grants.listActive', cause)
  );
}

export function findGrantById(grantId: string): ResultAsync<RoleGrant | null, AppError> {
  const query = supabaseAdmin
    .from('role_grants')
    .select('*')
    .eq('id', grantId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grants.findById', cause)
  );
}

export function insertGrant(
  row: InsertTables<'role_grants'>
): ResultAsync<RoleGrant, AppError> {
  const query = supabaseAdmin
    .from('role_grants')
    .insert(row)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('role_grants.insert', cause));
}

/**
 * Atomic guarded status transition. `expected` is the status the row MUST
 * currently hold; a null result means the transition was already applied (lost
 * race / double-click), NOT an error - callers map null to CONFLICT or a no-op.
 */
export function setGrantStatus(
  grantId: string,
  expected: RoleGrantStatus,
  next: RoleGrantStatus,
  endedAt: string | null
): ResultAsync<RoleGrant | null, AppError> {
  const query = supabaseAdmin
    .from('role_grants')
    .update({
      status: next,
      ended_at: endedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', grantId)
    .eq('status', expected)
    .select()
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grants.setStatus', cause)
  );
}

// === Applications ========================================================

export function insertApplication(
  row: InsertTables<'community_manager_applications'>
): ResultAsync<CommunityManagerApplication, AppError> {
  const query = supabaseAdmin
    .from('community_manager_applications')
    .insert(row)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('community_manager_applications.insert', cause)
  );
}

export function findApplicationById(
  id: string
): ResultAsync<CommunityManagerApplication | null, AppError> {
  const query = supabaseAdmin
    .from('community_manager_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('community_manager_applications.findById', cause)
  );
}

/** The applicant's most recent application, any status. */
export function findLatestApplicationForUser(
  userId: string
): ResultAsync<CommunityManagerApplication | null, AppError> {
  const query = supabaseAdmin
    .from('community_manager_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('community_manager_applications.findLatestForUser', cause)
  );
}

/** A submitted application joined to the applicant, for the review console. */
export interface SubmittedApplicationRow extends CommunityManagerApplication {
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    municipality_id: string | null;
  } | null;
}

/**
 * The review queue. `spaceIds === null` means platform-wide (super_admin);
 * otherwise restrict with .in('space_id', spaceIds).
 * Joins the applicant so the console can render a name without a second round trip.
 */
export function listSubmittedApplications(
  spaceIds: string[] | null
): ResultAsync<SubmittedApplicationRow[], AppError> {
  const base = supabaseAdmin
    .from('community_manager_applications')
    .select(
      '*, users!community_manager_applications_user_id_fkey(id, first_name, last_name, email, municipality_id)'
    )
    .eq('status', 'submitted');

  const scoped = spaceIds === null ? base : base.in('space_id', spaceIds);

  const query = scoped
    .order('created_at', { ascending: true })
    .limit(200)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as unknown as SubmittedApplicationRow[];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('community_manager_applications.listSubmitted', cause)
  );
}

/**
 * Atomic guarded decision. Only a still-'submitted' application can be decided;
 * a null result means another reviewer already decided it.
 */
export function decideApplication(
  id: string,
  next: 'approved' | 'rejected',
  reviewerId: string,
  reason: string
): ResultAsync<CommunityManagerApplication | null, AppError> {
  const query = supabaseAdmin
    .from('community_manager_applications')
    .update({
      status: next,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'submitted')
    .select()
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('community_manager_applications.decide', cause)
  );
}

// === Audit (append-only) =================================================
//
// Insert and read only. UPDATE or DELETE here raises in the database
// (role_grant_events_append_only trigger, migration 20260802000002).

export function insertAuditEvent(
  row: InsertTables<'role_grant_events'>
): ResultAsync<RoleGrantEvent, AppError> {
  const query = supabaseAdmin
    .from('role_grant_events')
    .insert(row)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grant_events.insert', cause)
  );
}

export function listAuditEvents(
  subjectType: AuditSubjectType,
  subjectId: string
): ResultAsync<RoleGrantEvent[], AppError> {
  const query = supabaseAdmin
    .from('role_grant_events')
    .select('*')
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('role_grant_events.listBySubject', cause)
  );
}
