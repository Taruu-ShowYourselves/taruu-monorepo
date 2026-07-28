/**
 * Push-token repository. Replaces the per-recipient N+1 lookup with one
 * batched query for an entire recipient list.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dbError, type AppError } from '@/server/http/errors';

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
