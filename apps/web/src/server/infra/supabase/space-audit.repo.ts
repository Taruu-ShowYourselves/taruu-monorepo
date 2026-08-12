import 'server-only';

/**
 * Space audit log - append and read, and nothing else.
 *
 * This module exports no `update*` and no `delete*` function. That absence is
 * the CI-checkable half of the append-only guarantee: a grep over this file
 * proves the application has no vocabulary for mutating history.
 *
 * The *enforceable* half is the database, migration `20260802000010`: a BEFORE
 * UPDATE/DELETE trigger that raises, a BEFORE TRUNCATE statement trigger, and a
 * REVOKE - plus `ON DELETE RESTRICT` on both foreign keys, so a user with audit
 * history cannot be deleted out from under it. RLS is not part of this: every
 * query here runs as the service role, which has BYPASSRLS. The manual probe is
 * `supabase/tests/audit_append_only.sql`.
 *
 * Reads are scope-gated like every other space query - a SpaceScope minted for
 * `audit.read` is the only key that opens them.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import type { InsertTables, SpaceAuditRow } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

/** Hard ceiling on a single audit page, independent of what the caller asks for. */
export const AUDIT_PAGE_MAX = 100;

export interface AuditFilter {
  /**
   * Typed to the column's own union rather than `string`: the CHECK constraint
   * rejects anything else, so a typo should be a compile error here rather than
   * a query that silently matches nothing.
   */
  objectType?: SpaceAuditRow['object_type'];
  actorId?: string;
  cursor?: string;
  limit?: number;
}

export interface AuditRowWithActor extends SpaceAuditRow {
  actor_first_name: string | null;
  actor_last_name: string | null;
}

export interface AuditPageRows {
  rows: AuditRowWithActor[];
  nextCursor: string | null;
  /** The caller asked for more than AUDIT_PAGE_MAX and was capped. */
  truncated: boolean;
}

type EmbeddedActor = {
  users: { first_name: string | null; last_name: string | null } | null;
};

/**
 * Keyset cursor over the log's sort key. Opaque to the client, and stable
 * because the rows it points into can never be edited or removed.
 */
const encodeCursor = (row: { created_at: string; id: string }): string =>
  `${row.created_at}|${row.id}`;

const decodeCursor = (cursor: string): { createdAt: string; id: string } | null => {
  const separator = cursor.lastIndexOf('|');
  if (separator <= 0 || separator === cursor.length - 1) return null;
  return { createdAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
};

export function insertAuditRow(
  row: InsertTables<'space_audit_log'>
): ResultAsync<SpaceAuditRow, AppError> {
  const query = supabaseAdmin
    .from('space_audit_log')
    .insert(row)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data as SpaceAuditRow;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_audit_log.insert', cause)
  );
}

/**
 * One page of history, newest first, keyset-paginated on `(created_at, id)`.
 *
 * Offset pagination is wrong here: the log is append-only and continuously
 * written, so a later page would duplicate or skip rows as new entries land.
 */
export function listAuditRows(
  scope: SpaceScope,
  filter: AuditFilter
): ResultAsync<AuditPageRows, AppError> {
  const requested = filter.limit ?? AUDIT_PAGE_MAX;
  const limit = Math.min(requested, AUDIT_PAGE_MAX);

  let builder = supabaseAdmin
    .from('space_audit_log')
    .select(
      'id, space_id, actor_user_id, action, object_type, object_id, prior_state, new_state, reason, created_at, users(first_name, last_name)'
    )
    .eq('space_id', scope.spaceId); // scope key, never a caller string

  if (filter.objectType) builder = builder.eq('object_type', filter.objectType);
  if (filter.actorId) builder = builder.eq('actor_user_id', filter.actorId);

  const after = filter.cursor ? decodeCursor(filter.cursor) : null;
  if (after) {
    // (created_at, id) < (cursor.createdAt, cursor.id), expressed for PostgREST.
    builder = builder.or(
      `created_at.lt.${after.createdAt},and(created_at.eq.${after.createdAt},id.lt.${after.id})`
    );
  }

  // Fetch one extra row to learn whether another page exists without a count.
  const query = builder
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)
    .then(({ data, error }) => {
      if (error) throw error;
      const fetched = (data ?? []) as unknown as Array<SpaceAuditRow & EmbeddedActor>;
      const hasMore = fetched.length > limit;
      const page = hasMore ? fetched.slice(0, limit) : fetched;
      const rows: AuditRowWithActor[] = page.map(({ users, ...row }) => ({
        ...row,
        actor_first_name: users?.first_name ?? null,
        actor_last_name: users?.last_name ?? null,
      }));
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? encodeCursor(last) : null,
        truncated: requested > AUDIT_PAGE_MAX,
      };
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('space_audit_log.list', cause));
}
