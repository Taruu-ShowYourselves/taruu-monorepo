import 'server-only';

/**
 * The one call into `space_admin_metrics` (migration 20260802000013).
 *
 * There is no table read here on purpose. The function has a fixed return type
 * of nine scalars, so a private column added later to `users` or `payments`
 * cannot reach this surface by someone widening a column list - the widening
 * would have to happen in a migration, in review, against a function whose
 * whole stated contract is that it returns aggregates.
 *
 * The floor of five is applied inside that function, not here: a bucket of 1-4
 * arrives already nulled, so the true small number never crosses the wire from
 * Postgres, let alone to a browser.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import { dbError, type AppError } from '@/server/http/errors';

/** The nine-column projection, taken from the generated signature. */
export type SpaceMetricsRow =
  Database['public']['Functions']['space_admin_metrics']['Returns'][number];

/**
 * `null` means the function produced no row - a space that vanished between
 * authorization and this query, or one with no municipality code. It is not an
 * error, and the caller must not turn it into zeroes.
 */
export function fetchSpaceMetrics(
  scope: SpaceScope
): ResultAsync<SpaceMetricsRow | null, AppError> {
  const query = supabaseAdmin
    .rpc('space_admin_metrics', { space_uuid: scope.spaceId })
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_admin_metrics', cause)
  );
}
