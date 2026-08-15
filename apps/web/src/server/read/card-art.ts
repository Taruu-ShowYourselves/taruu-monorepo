import 'server-only';
import { cache } from 'react';
import { getCardArtByVoteIds } from '@/lib/supabase/db';
import { activeVotesWithOptions } from './active-votes';

/**
 * Card-art plates for every active vote, memoised for one request.
 *
 * Three desks print off the same ledger - the civic desk, the national desk
 * and the intro's decorative backdrop - and each used to issue its own
 * `getCardArtByVoteIds` query for its own slice of ids. `cache` keys on
 * arguments, so memoising the per-ids helper directly would still open one
 * entry per caller; this read is argument-free on purpose, derives the ids
 * from the shared ledger, and every desk takes its plates out of the one map.
 *
 * The underlying helper already degrades to an empty map on DB failure, so
 * the empty edition stays empty rather than failing the page.
 */
export const activeVoteCardArt = cache(async () => {
  const votes = await activeVotesWithOptions();
  return getCardArtByVoteIds(votes.map((v) => v.id));
});
