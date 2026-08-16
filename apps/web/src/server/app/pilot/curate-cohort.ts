import type { CurateCohortRequest } from '@sync/shared/contracts';
import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import type { Json, PilotMunicipality } from '@/lib/supabase/types';
import { validation, type AppError } from '@/server/http/errors';
import { insertPilotAudit } from '@/server/infra/supabase/pilot-audit.repo';
import {
  clearLiveCohortRanks,
  completeCohortRows,
  deleteSelectedCohortRows,
  engagementRanking,
  listCohort,
  upsertCohortRows,
} from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';
import { requirePilotAdmin } from './authorize';

export function curatePilotCohort(
  session: Session | null,
  command: CurateCohortRequest
): ResultAsync<{ cohort: PilotMunicipality[] }, AppError> {
  return requirePilotAdmin(session).andThen((admin) =>
    engagementRanking().andThen((ranking) => {
      const rankingById = new Map(ranking.map((row) => [row.municipality_id, row]));
      const missing = command.entries
        .map((entry) => entry.municipalityId)
        .filter((id) => !rankingById.has(id));
      if (missing.length > 0) {
        return errAsync<{ cohort: PilotMunicipality[] }, AppError>(
          validation(missing.map((id) => `${id}: no measured engagement data`))
        );
      }

      return listCohort().andThen((before) => {
        const requested = new Set(command.entries.map((entry) => entry.municipalityId));
        const removed = before.filter(
          (row) => !requested.has(row.municipality_id) && row.status !== 'completed'
        );
        const beforeById = new Map(before.map((row) => [row.municipality_id, row]));
        const now = new Date().toISOString();
        const rows = command.entries.map((entry) => {
          const measured = rankingById.get(entry.municipalityId)!;
          const prior = beforeById.get(entry.municipalityId);
          const snapshot = {
            votes: Number(measured.vote_count),
            posts: Number(measured.post_count),
            comments: Number(measured.comments_count),
            reactions: Number(measured.reactions_count),
            computed_at: now,
          } satisfies Json;
          return {
            municipality_id: entry.municipalityId,
            rank: entry.rank,
            engagement_score: Number(measured.score),
            engagement_snapshot: snapshot,
            status:
              prior?.status === 'active' || prior?.status === 'paused'
                ? prior.status
                : 'selected' as const,
            curated_by: admin.userId,
            curated_at: now,
            activated_at: prior?.activated_at ?? null,
            updated_at: now,
          };
        });

        const selectedToDelete = removed
          .filter((row) => row.status === 'selected')
          .map((row) => row.municipality_id);
        const liveToComplete = removed
          .filter((row) => row.status === 'active' || row.status === 'paused')
          .map((row) => row.municipality_id);

        return clearLiveCohortRanks()
          .andThen(() => upsertCohortRows(rows))
          .andThen(() =>
            selectedToDelete.length > 0
              ? deleteSelectedCohortRows(selectedToDelete)
              : okAsync<void, AppError>(undefined)
          )
          .andThen(() =>
            liveToComplete.length > 0
              ? completeCohortRows(liveToComplete)
              : okAsync<void, AppError>(undefined)
          )
          .andThen(() =>
            insertPilotAudit({
              actor_user_id: admin.userId,
              action: 'cohort.curated',
              object_type: 'cohort',
              prior_state: before as unknown as Json,
              new_state: rows as unknown as Json,
            })
          )
          .andThen(() => listCohort())
          .map((cohort) => ({ cohort }));
      });
    })
  );
}
