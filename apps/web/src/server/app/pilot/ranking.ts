import type { PilotRankingRow } from '@sync/shared/contracts';
import type { ResultAsync } from 'neverthrow';
import type { AppError } from '@/server/http/errors';
import { engagementRanking, listCohort } from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';
import { requirePilotAdmin } from './authorize';

export function getPilotRanking(
  session: Session | null
): ResultAsync<{ rows: PilotRankingRow[]; hasEngagementData: boolean }, AppError> {
  return requirePilotAdmin(session).andThen(() =>
    engagementRanking().andThen((ranking) =>
      listCohort().map((cohort) => {
        const byMunicipality = new Map(cohort.map((row) => [row.municipality_id, row]));
        const rows = ranking.map((row) => {
          const selected = byMunicipality.get(row.municipality_id);
          return {
            municipalityId: row.municipality_id,
            voteCount: Number(row.vote_count),
            postCount: Number(row.post_count),
            commentsCount: Number(row.comments_count),
            reactionsCount: Number(row.reactions_count),
            score: Number(row.score),
            cohort: selected
              ? { rank: selected.rank, status: selected.status }
              : null,
          } satisfies PilotRankingRow;
        });
        return { rows, hasEngagementData: rows.length > 0 };
      })
    )
  );
}
