import 'server-only';

/**
 * Aggregate-only statistics (Surface 4) - SPACE-07.
 *
 * One capability, one RPC, one mapping. The surface is deliberately incapable
 * of a drill-down: there is no per-resident shape anywhere between the SQL
 * function's nine scalars and this response, so a future "just add a list"
 * request has to change the database, not this file.
 *
 * The three statuses are the whole point of the contract. `available` is a
 * measured figure and may legitimately be zero. `suppressed` means the bucket
 * exists but is smaller than the k-anonymity floor of five. `unavailable` means
 * the figure could not be computed at all. The surface must be able to say the
 * third of those without erroring - the UI renders `-` for exactly that case,
 * and answering with a zero instead would be a fabricated number presented as a
 * measurement.
 */

import type { ResultAsync } from 'neverthrow';
import type { SpaceMetric, SpaceMetricsResponse } from '@sync/shared/contracts';
import { authorize } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import {
  fetchSpaceMetrics,
  type SpaceMetricsRow,
} from '@/server/infra/supabase/space-metrics.repo';
import type { Session } from '@/services/auth/session';

const UNAVAILABLE: SpaceMetric = { value: null, status: 'unavailable' };

/**
 * The database owns both halves of a figure. Reading the value only when the
 * status says it is publishable makes the floor hold in two independent places:
 * a future edit to the SQL that forgot to null a suppressed bucket would leak
 * nothing through here.
 */
const figure = (value: number | null, status: SpaceMetric['status']): SpaceMetric => ({
  value: status === 'available' ? value : null,
  status,
});

const toResponse = (row: SpaceMetricsRow): SpaceMetricsResponse => ({
  registeredResidents: figure(row.registered_residents, row.registered_residents_status),
  activeParticipants30d: figure(
    row.active_participants_30d,
    row.active_participants_30d_status
  ),
  proposalsSubmitted: figure(row.proposals_submitted, row.proposals_submitted_status),
  participationRate: figure(
    row.participation_rate_pct,
    row.participation_rate_pct_status
  ),
  generatedAt: row.generated_at,
});

/**
 * No row is an answer, not a failure: every figure becomes `unavailable` and
 * the request succeeds. A database error is a different thing entirely and
 * still fails the request - an empty figure that silently means "the query
 * broke" would be indistinguishable from one that means "nobody has voted yet".
 */
const noMetrics = (): SpaceMetricsResponse => ({
  registeredResidents: UNAVAILABLE,
  activeParticipants30d: UNAVAILABLE,
  proposalsSubmitted: UNAVAILABLE,
  participationRate: UNAVAILABLE,
  generatedAt: new Date().toISOString(),
});

export function getSpaceMetrics(
  session: Session,
  rawSpaceId: string
): ResultAsync<SpaceMetricsResponse, AppError> {
  return authorize(session, rawSpaceId, 'metrics.read')
    .andThen(fetchSpaceMetrics)
    .map((row) => (row === null ? noMetrics() : toResponse(row)));
}
