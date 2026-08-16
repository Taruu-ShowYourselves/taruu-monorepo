import type { CreateCampaignRequest, MarkPostedRequest, PilotCampaign, SaveCopyRequest } from '@sync/shared/contracts';
import { errAsync, ResultAsync, type ResultAsync as ResultAsyncType } from 'neverthrow';
import type { Json, PilotCampaignCopyRow, PilotCampaignRow } from '@/lib/supabase/types';
import { conflict, notFound, type AppError } from '@/server/http/errors';
import { draftPilotFacebookPost, pilotCopyModel } from '@/server/infra/google/draft-pilot-post';
import { insertPilotAudit } from '@/server/infra/supabase/pilot-audit.repo';
import {
  deletePilotCampaign,
  findPilotCampaign,
  insertCampaignCopy,
  insertPilotCampaign,
  listCampaignCopies,
  listPilotCampaigns,
  markCampaignPosted,
  setCampaignCurrentCopy,
} from '@/server/infra/supabase/pilot-campaign.repo';
import { generateAvailablePilotLinkCode } from '@/server/domain/pilot/link-code';
import { findPilotLinkByCampaign, insertPilotLink, pilotLinkCodeExists } from '@/server/infra/supabase/pilot-link.repo';
import { findCohortRow, getVotesByIds, listPilotVotes } from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';
import { requirePilotAdmin } from './authorize';

function toCopy(copy: PilotCampaignCopyRow) {
  return { id: copy.id, version: copy.version, body: copy.body, author: copy.author, model: copy.model, createdAt: copy.created_at };
}

function mapCampaign(row: PilotCampaignRow, copies: PilotCampaignCopyRow[], linkCode: string | null): PilotCampaign {
  const current = copies.find((copy) => copy.id === row.current_copy_id) ?? null;
  return {
    id: row.id, municipalityId: row.municipality_id, groupName: row.group_name, groupUrl: row.group_url,
    status: row.status, linkCode, currentCopy: current ? toCopy(current) : null,
    postedAt: row.posted_at, postPermalink: row.post_permalink, createdAt: row.created_at,
  };
}

export function listCampaignDesk(session: Session | null): ResultAsyncType<{ campaigns: PilotCampaign[] }, AppError> {
  return requirePilotAdmin(session).andThen(() => listPilotCampaigns().andThen((rows) =>
    ResultAsync.combine(rows.map((row) => listCampaignCopies(row.id).andThen((copies) =>
      findPilotLinkByCampaign(row.id).map((link) => mapCampaign(row, copies, link?.code ?? null))
    ))).map((campaigns) => ({ campaigns }))
  ));
}

// Kept deliberately small: the public dashboard list is composed by its API
// route with a direct link query. Mutations below carry all business rules.
export function createPilotCampaign(session: Session | null, command: CreateCampaignRequest): ResultAsyncType<{ campaign: PilotCampaignRow; linkCode: string }, AppError> {
  return requirePilotAdmin(session).andThen((admin) => findCohortRow(command.municipalityId).andThen((cohort) => {
    if (!cohort || cohort.status === 'completed') return errAsync(notFound('pilot municipality'));
    return insertPilotCampaign({ municipality_id: command.municipalityId, created_by: admin.userId, group_name: command.groupName, group_url: command.groupUrl ?? null }).andThen((campaign) =>
      ResultAsync.fromPromise(generateAvailablePilotLinkCode(pilotLinkCodeExists), (cause) => ({ kind: 'INTERNAL', cause: String(cause) } as AppError)).andThen((code) =>
        insertPilotLink({ code, campaign_id: campaign.id, municipality_id: campaign.municipality_id, created_by: admin.userId }).andThen(() =>
          insertPilotAudit({ actor_user_id: admin.userId, municipality_id: campaign.municipality_id, action: 'campaign.created', object_type: 'campaign', object_id: campaign.id, new_state: campaign as unknown as Json })
            .andThen(() => insertPilotAudit({ actor_user_id: admin.userId, municipality_id: campaign.municipality_id, action: 'link.created', object_type: 'link', object_id: code, new_state: { code, campaignId: campaign.id } as Json }))
            .map(() => ({ campaign, linkCode: code }))
        ).orElse((error) => deletePilotCampaign(campaign.id).andThen(() => errAsync(error)))
      )
    );
  }));
}

function createCopy(
  session: Session | null,
  campaignId: string,
  input: { body: string; author: 'llm' | 'human'; model?: string | null; prompt?: Json | null }
): ResultAsyncType<{ copy: ReturnType<typeof toCopy> }, AppError> {
  return requirePilotAdmin(session).andThen((admin) =>
    findPilotCampaign(campaignId).andThen((campaign) => {
      if (!campaign) return errAsync(notFound('campaign'));
      if (campaign.status === 'posted' || campaign.status === 'archived') {
        return errAsync(conflict('campaign can no longer be edited'));
      }
      return listCampaignCopies(campaignId).andThen((copies) =>
        insertCampaignCopy({
          campaign_id: campaignId,
          version: (copies[0]?.version ?? 0) + 1,
          body: input.body,
          author: input.author,
          author_user_id: admin.userId,
          model: input.model ?? null,
          prompt_snapshot: input.prompt ?? null,
        }).andThen((copy) =>
          setCampaignCurrentCopy(campaignId, copy.id).andThen(() =>
            insertPilotAudit({
              actor_user_id: admin.userId,
              municipality_id: campaign.municipality_id,
              action: input.author === 'llm' ? 'copy.drafted' : 'copy.edited',
              object_type: 'copy',
              object_id: copy.id,
              new_state: copy as unknown as Json,
            }).map(() => ({ copy: toCopy(copy) }))
          )
        )
      );
    })
  );
}

export function savePilotCampaignCopy(session: Session | null, campaignId: string, command: SaveCopyRequest) {
  return createCopy(session, campaignId, { body: command.body, author: 'human' });
}

export function draftPilotCampaignCopy(session: Session | null, campaignId: string, origin: string) {
  return requirePilotAdmin(session).andThen(() =>
    findPilotCampaign(campaignId).andThen((campaign) => {
      if (!campaign) return errAsync(notFound('campaign'));
      if (campaign.status === 'posted' || campaign.status === 'archived') {
        return errAsync(conflict('campaign can no longer be edited'));
      }
      return listPilotVotes(campaign.municipality_id).andThen((pilotVotes) => {
        if (pilotVotes.length !== 5) return errAsync(conflict('campaign needs five selected pilot votes before drafting'));
        return getVotesByIds(pilotVotes.map((row) => row.vote_id)).andThen((votes) => {
          if (votes.length !== 5) return errAsync(conflict('campaign pilot votes are incomplete'));
          return findPilotLinkByCampaign(campaignId).andThen((link) => {
            if (!link) return errAsync(conflict('campaign link is missing'));
            const byVoteId = new Map(votes.map((vote) => [vote.id, vote]));
            const topics = [...pilotVotes]
              .sort((a, b) => a.position - b.position)
              .map((row) => {
                const vote = byVoteId.get(row.vote_id)!;
                return { title: vote.title, participantCount: vote.participant_count ?? 0 };
              });
            const publicUrl = new URL(`/l/${link.code}`, origin).toString();
            const prompt = { municipality: campaign.municipality_id, link: publicUrl, topics } as Json;
            return ResultAsync.fromPromise(
              draftPilotFacebookPost({ municipality: campaign.municipality_id, link: publicUrl, topics }),
              (cause) => ({ kind: 'INTERNAL', cause: String(cause) } as AppError)
            ).andThen((body) =>
              createCopy(session, campaignId, {
                body,
                author: 'llm',
                model: pilotCopyModel(),
                prompt,
              })
            );
          });
        });
      });
    })
  );
}

export function markPilotCampaignPosted(session: Session | null, campaignId: string, command: MarkPostedRequest) {
  return requirePilotAdmin(session).andThen((admin) => findPilotCampaign(campaignId).andThen((before) => {
    if (!before) return errAsync(notFound('campaign'));
    return markCampaignPosted(campaignId, admin.userId, command.permalink).andThen((campaign) => {
      if (!campaign) return errAsync(conflict('campaign must be ready before marking posted'));
      return insertPilotAudit({ actor_user_id: admin.userId, municipality_id: campaign.municipality_id, action: 'campaign.posted', object_type: 'campaign', object_id: campaign.id, prior_state: before as unknown as Json, new_state: campaign as unknown as Json }).map(() => ({ campaign }));
    });
  }));
}
