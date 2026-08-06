import type { PilotStatusResponse } from '@sync/shared/contracts';
import { ResultAsync } from 'neverthrow';
import type { AppError } from '@/server/http/errors';
import { getVotesByIds, listCohort, listPilotVotes } from '@/server/infra/supabase/pilot.repo';

export function getPilotStatus(): ResultAsync<PilotStatusResponse, AppError> {
  return listCohort().andThen((cohort) => {
    const active = cohort.filter((row) => row.status === 'active');
    return ResultAsync.combine(
      active.map((municipality) =>
        listPilotVotes(municipality.municipality_id).andThen((pilotVotes) =>
          getVotesByIds(pilotVotes.map((row) => row.vote_id)).map((votes) => {
            const byId = new Map(votes.map((vote) => [vote.id, vote]));
            return {
              municipalityId: municipality.municipality_id,
              rank: municipality.rank,
              votes: pilotVotes.flatMap((row) => {
                const vote = byId.get(row.vote_id);
                return vote
                  ? [{
                      voteId: vote.id,
                      title: vote.title,
                      position: row.position,
                      participantCount: vote.participant_count ?? 0,
                    }]
                  : [];
              }),
            };
          })
        )
      )
    ).map((municipalities) => ({ municipalities }));
  });
}
