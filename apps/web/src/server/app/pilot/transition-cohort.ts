import { errAsync, type ResultAsync } from 'neverthrow';
import type { Json, PilotMunicipality } from '@/lib/supabase/types';
import { conflict, notFound, type AppError } from '@/server/http/errors';
import { insertPilotAudit } from '@/server/infra/supabase/pilot-audit.repo';
import {
  findCohortRow,
  getVotesByIds,
  listPilotVotes,
  transitionCohortStatus,
} from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';
import { requirePilotAdmin } from './authorize';

export function activatePilotMunicipality(
  session: Session | null,
  municipalityId: string
): ResultAsync<{ municipality: PilotMunicipality }, AppError> {
  return requirePilotAdmin(session).andThen((admin) =>
    findCohortRow(municipalityId).andThen((before) => {
      if (!before) return errAsync<{ municipality: PilotMunicipality }, AppError>(notFound('pilot municipality'));
      return listPilotVotes(municipalityId).andThen((rows) =>
        getVotesByIds(rows.map((row) => row.vote_id)).andThen((votes) => {
          const now = Date.now();
          const ready =
            rows.length === 5 &&
            votes.length === 5 &&
            votes.every(
              (vote) =>
                vote.status === 'active' && new Date(vote.end_date).getTime() > now
            );
          if (!ready) {
            return errAsync<{ municipality: PilotMunicipality }, AppError>(
              conflict('activation requires exactly five open, active votes')
            );
          }
          return transitionCohortStatus(
          municipalityId,
          ['selected', 'paused'],
          'active',
          { activated_at: before.activated_at ?? new Date().toISOString() }
          ).andThen((municipality) => {
            if (!municipality) {
              return errAsync<{ municipality: PilotMunicipality }, AppError>(conflict('municipality is not activatable'));
            }
            return insertPilotAudit({
              actor_user_id: admin.userId,
              municipality_id: municipalityId,
              action: 'cohort.activated',
              object_type: 'cohort',
              object_id: municipalityId,
              prior_state: before as unknown as Json,
              new_state: municipality as unknown as Json,
            }).map(() => ({ municipality }));
          });
        })
      );
    })
  );
}

export function pausePilotMunicipality(
  session: Session | null,
  municipalityId: string
): ResultAsync<{ municipality: PilotMunicipality }, AppError> {
  return requirePilotAdmin(session).andThen((admin) =>
    findCohortRow(municipalityId).andThen((before) => {
      if (!before) return errAsync<{ municipality: PilotMunicipality }, AppError>(notFound('pilot municipality'));
      return transitionCohortStatus(municipalityId, ['active'], 'paused').andThen((municipality) => {
        if (!municipality) {
          return errAsync<{ municipality: PilotMunicipality }, AppError>(conflict('municipality is not active'));
        }
        return insertPilotAudit({
          actor_user_id: admin.userId,
          municipality_id: municipalityId,
          action: 'cohort.paused',
          object_type: 'cohort',
          object_id: municipalityId,
          prior_state: before as unknown as Json,
          new_state: municipality as unknown as Json,
        }).map(() => ({ municipality }));
      });
    })
  );
}
