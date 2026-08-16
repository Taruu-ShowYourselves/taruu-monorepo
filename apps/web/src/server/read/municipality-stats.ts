import 'server-only';
import { cache } from 'react';
import { getMunicipalityCivicStats } from '@/lib/supabase/db';

/**
 * Every municipality's civic stats, memoised for the lifetime of one request.
 *
 * The desk's municipality dial reads all of them at once - a reader spinning
 * the dial must not wait on a fetch per city - and more than one desk on the
 * page may want the same list, so the read collapses to a single RPC.
 *
 * Degrades to an empty list rather than throwing, matching
 * `activeVotesWithOptions`: a build-time prerender with no service-role key
 * (#39) prints a desk with no dial, not a failed page.
 */
export const municipalityCivicStats = cache(() =>
  getMunicipalityCivicStats().catch(() => [])
);
