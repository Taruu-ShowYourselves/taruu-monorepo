import type { SetPilotVotesRequest } from '@sync/shared/contracts';
import { errAsync, type ResultAsync } from 'neverthrow';
import type { Json, PilotVoteRow } from '@/lib/supabase/types';
import { conflict, notFound, validation, type AppError } from '@/server/http/errors';
import { insertPilotAudit } from '@/server/infra/supabase/pilot-audit.repo';
import {
  activatePendingVotes,
  findCohortRow,
  getVotesByIds,
  listPilotVotes,
  replacePilotVotes,
} from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';
import { requirePilotAdmin } from './authorize';

export function selectPilotVotes(
  session: Session | null,
  municipalityId: string,
  command: SetPilotVotesRequest
): ResultAsync<{ votes: PilotVoteRow[] }, AppError> {
  return requirePilotAdmin(session).andThen((admin) =>
    findCohortRow(municipalityId).andThen((cohort) => {
      if (!cohort) return errAsync<{ votes: PilotVoteRow[] }, AppError>(notFound('pilot municipality'));
      if (cohort.status === 'completed') {
        return errAsync<{ votes: PilotVoteRow[] }, AppError>(conflict('pilot municipality is completed'));
      }

      const ids = command.votes.map((vote) => vote.voteId);
      return getVotesByIds(ids).andThen((votes) => {
        if (votes.length !== ids.length) {
          return errAsync<{ votes: PilotVoteRow[] }, AppError>(validation(['one or more votes do not exist']));
        }
        const invalid = votes.filter(
          (vote) =>
            vote.municipality_id !== municipalityId ||
            vote.hidden_at !== null ||
            !['pending', 'active'].includes(vote.status)
        );
        if (invalid.length > 0) {
          return errAsync<{ votes: PilotVoteRow[] }, AppError>(
            validation(invalid.map((vote) => `${vote.id}: vote is not an available ${municipalityId} vote`))
          );
        }

        const endDate = command.endDate ?? new Date(Date.now() + 30 * 86_400_000).toISOString();
        const rows = command.votes.map((vote) => ({
          municipality_id: municipalityId,
          vote_id: vote.voteId,
          position: vote.position,
          added_by: admin.userId,
        }));
        return listPilotVotes(municipalityId).andThen((before) =>
          activatePendingVotes(ids, municipalityId, endDate)
            .andThen(() => replacePilotVotes(municipalityId, rows))
            .andThen(() =>
              insertPilotAudit({
                actor_user_id: admin.userId,
                municipality_id: municipalityId,
                action: 'votes.selected',
                object_type: 'vote_set',
                object_id: municipalityId,
                prior_state: before as unknown as Json,
                new_state: rows as unknown as Json,
              })
            )
            .andThen(() => listPilotVotes(municipalityId))
            .map((selected) => ({ votes: selected }))
        );
      });
    })
  );
}
