import 'server-only';
import { cache } from 'react';
import { getActiveVotesWithOptions } from '@/lib/supabase/db';

/**
 * Every active vote network-wide, memoised for the lifetime of one request.
 *
 * The front page prints two desks off one ledger: the civic desk takes the
 * municipal rows, the national desk the Knesset ones. Each used to issue its
 * own Supabase query - `getActiveVotesWithOptions()` and the same call scoped
 * to `KNESSET_SCOPE` - so a single render paid for the ledger twice. React's
 * `cache` collapses that to one round-trip and each desk filters the shared
 * payload for its own scope; the national rows were already in the unscoped
 * result, the civic desk was simply discarding them.
 *
 * Deliberately argument-free: `cache` keys on arguments, so a scoped variant
 * would open a second cache entry and defeat the point.
 *
 * Degrades to an empty ledger rather than throwing, matching what both desks
 * did individually - a build-time prerender with no service-role key (#39)
 * must print an empty edition, not fail the page.
 */
export const activeVotesWithOptions = cache(() =>
  getActiveVotesWithOptions().catch(() => [])
);
