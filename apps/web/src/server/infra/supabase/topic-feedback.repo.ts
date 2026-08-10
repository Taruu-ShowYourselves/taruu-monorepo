/**
 * Topic feedback repository — the "not a matter of consensus" signal.
 *
 * Result-typed throughout: every call here sits behind an API route, unlike
 * the roster importers next door which run in a cron job that keeps its own
 * failure count.
 */

import { ResultAsync } from 'neverthrow';
import type { SetAsideReason } from '@sync/shared/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dbError, type AppError } from '@/server/http/errors';

export interface AsideStandingRow {
  asideCount: number;
  ownReason: SetAsideReason | null;
}

/** True when the topic exists at all — a 404 is nicer than a foreign-key 500. */
export function topicExists(voteId: string): ResultAsync<boolean, AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select('id')
    .eq('id', voteId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data !== null;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('votes.exists', cause));
}

/**
 * The topic's standing: how many readers set it aside, and whether the caller
 * is one of them. Two statements rather than one join because the count is
 * public and the caller's own row is not — keeping them apart makes it hard to
 * serve the second to somebody who only asked for the first.
 */
export function asideStanding(
  voteId: string,
  userId: string | null
): ResultAsync<AsideStandingRow, AppError> {
  const query = (async (): Promise<AsideStandingRow> => {
    const counted = await supabaseAdmin
      .from('topic_set_aside')
      .select('id', { count: 'exact', head: true })
      .eq('vote_id', voteId);
    if (counted.error) throw counted.error;

    if (!userId) return { asideCount: counted.count ?? 0, ownReason: null };

    const mine = await supabaseAdmin
      .from('topic_set_aside')
      .select('reason')
      .eq('vote_id', voteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (mine.error) throw mine.error;

    return {
      asideCount: counted.count ?? 0,
      ownReason: (mine.data?.reason as SetAsideReason | undefined) ?? null,
    };
  })();

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('topic_set_aside.standing', cause)
  );
}

/** Set aside, or amend an existing reason. One row per reader per topic. */
export function upsertSetAside(input: {
  voteId: string;
  userId: string;
  reason: SetAsideReason;
}): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('topic_set_aside')
    .upsert(
      {
        vote_id: input.voteId,
        user_id: input.userId,
        reason: input.reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vote_id,user_id' }
    )
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('topic_set_aside.upsert', cause)
  );
}

/** Put the topic back. A real delete: the retracted row is not evidence. */
export function removeSetAside(
  voteId: string,
  userId: string
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('topic_set_aside')
    .delete()
    .eq('vote_id', voteId)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('topic_set_aside.delete', cause)
  );
}
