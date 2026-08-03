/**
 * Push-token repository. Replaces the per-recipient N+1 lookup with one
 * batched query for an entire recipient list.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dbError, type AppError } from '@/server/http/errors';

/**
 * Which of these users can currently be reached on a device.
 *
 * `activeTokensForUsers` deliberately dedups down to bare tokens, which throws
 * away the user each one belongs to — correct for a fan-out, useless for a
 * count of *people* with no channel. SPACE-08's preview has to report that
 * count before it will let an admin send, so it needs the user-level answer.
 * Same one batched query, same table, same repository: this is the second
 * projection of it, not a second access path.
 */
export function usersWithActiveChannel(
  userIds: string[]
): ResultAsync<Set<string>, AppError> {
  if (userIds.length === 0)
    return ResultAsync.fromSafePromise(Promise.resolve(new Set<string>()));
  return ResultAsync.fromPromise(
    Promise.resolve(
      supabaseAdmin
        .from('push_tokens')
        .select('user_id')
        .in('user_id', userIds)
        .eq('is_active', true)
    ).then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.user_id));
    }),
    (cause) => dbError('push_tokens.usersWithActiveChannel', cause)
  );
}

export function activeTokensForUsers(
  userIds: string[]
): ResultAsync<string[], AppError> {
  if (userIds.length === 0) return ResultAsync.fromSafePromise(Promise.resolve([]));
  return ResultAsync.fromPromise(
    Promise.resolve(
      supabaseAdmin
        .from('push_tokens')
        .select('token')
        .in('user_id', userIds)
        .eq('is_active', true)
    ).then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return [...new Set((data ?? []).map((r) => r.token))];
    }),
    (cause) => dbError('push_tokens.forUsers', cause)
  );
}
