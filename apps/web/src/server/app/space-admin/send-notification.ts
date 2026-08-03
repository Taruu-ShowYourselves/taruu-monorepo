import 'server-only';

/**
 * The send (Surface 5) — where SPACE-08 stops being an intention.
 *
 * The requirement is an equality between two sets: the recipients the admin was
 * shown and the recipients who are delivered to. Two things could break it
 * between the preview and the send, and each gets its own refusal:
 *
 *   - the message changed  → the audience was costed for something else
 *   - the membership moved → the costed audience is no longer this audience
 *
 * Both are verified against the campaign row the preview persisted, by re-running
 * the same two functions that produced it. Neither can be waived by the client,
 * because neither fingerprint is client-supplied — the recipient list is resolved
 * here, from the space, every time.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  SpaceNotificationQuota,
} from '@sync/shared/contracts';
import { contentHash, resolveAudience } from '@/server/app/space-admin/audience';
import { authorize } from '@/server/app/space-admin/authorize';
import { conflict, forbidden, quotaExceeded, type AppError } from '@/server/http/errors';
import { fanOutCampaignPush } from '@/server/infra/notify/space-campaign';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  claimCampaignForSend,
  countCampaignsSentThisMonth,
  findCampaignInScope,
  insertDeliveries,
  insertUserNotifications,
  listCampaignsForSpace,
  nextMonthStartIso,
  readSpaceQuota,
  type NewDelivery,
} from '@/server/infra/supabase/space-notify.repo';
import type { Session } from '@/services/auth/session';

/** Verbatim from the copy deck; the composer maps 409 to whichever it receives. */
const CONTENT_STALE_HE = 'ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.';
const AUDIENCE_STALE_HE = 'הקהל השתנה — הציגו תצוגה מקדימה מחדש.';

/** The history list is a header, not an archive. */
const PAST_CAMPAIGNS_LIMIT = 20;

export interface SendNotificationDeps {
  /** Hands work to `after()`, so the push never sits on the request path. */
  defer: (task: () => Promise<void>) => void;
}

export function sendNotification(
  deps: SendNotificationDeps,
  session: Session,
  rawSpaceId: string,
  cmd: SendNotificationRequest
): ResultAsync<SendNotificationResponse, AppError> {
  // 1. Capability first. Nothing below this line runs for a caller who cannot
  //    send in this space.
  return authorize(session, rawSpaceId, 'notification.send').andThen((scope) =>
    // 2. Read the campaign THROUGH the scope. A campaign in another space reads
    //    back null, and null is the same opaque refusal as one that does not
    //    exist — a 404 here would confirm the id is real somewhere else.
    findCampaignInScope(scope, cmd.campaignId).andThen((campaign) => {
      if (campaign === null) {
        return errAsync<SendNotificationResponse, AppError>(forbidden());
      }

      // 3. The quota, counted from the database, before anything is written.
      //
      //    This is the quota of record. It cannot be a request-rate limiter:
      //    `lib/rate-limit.ts` degrades to an in-process `Map` whenever Upstash
      //    is unconfigured — which it is in this deployment — and on Cloudflare
      //    Workers that map is per-isolate, so N isolates would each grant this
      //    space a full monthly allowance. The count below is over durable
      //    campaign rows with a `sent_at` in the current calendar month.
      //
      //    At-or-over, not past: with a quota of eight, the ninth send is
      //    refused because eight have already been spent.
      return ResultAsync.combine([
        countCampaignsSentThisMonth(scope),
        readSpaceQuota(scope),
      ] as const).andThen(([used, limit]) => {
        if (used >= limit) {
          return errAsync<SendNotificationResponse, AppError>(
            quotaExceeded('space-notification')
          );
        }

        // 4. Content verification. Re-derive the fingerprint from the SUBMITTED
        //    payload and compare it with what the preview persisted, then compare
        //    the echoed token as well. The two catch different failures: a
        //    recomputation mismatch is an edited message, a token mismatch is a
        //    replayed or fabricated token against an unedited one.
        return ResultAsync.fromSafePromise(contentHash(cmd)).andThen((recomputed) => {
          if (
            recomputed !== campaign.content_hash ||
            cmd.previewToken !== campaign.content_hash
          ) {
            return errAsync<SendNotificationResponse, AppError>(
              conflict(CONTENT_STALE_HE)
            );
          }

          // 5. Audience verification. The same resolver the preview called —
          //    there is no second recipient query anywhere in the codebase — so
          //    a membership change becomes an explicit, testable refusal instead
          //    of a silent divergence between what was shown and what is sent.
          return resolveAudience(scope, cmd.audienceFilter).andThen((audience) => {
            if (audience.hash !== campaign.audience_hash) {
              return errAsync<SendNotificationResponse, AppError>(
                conflict(AUDIENCE_STALE_HE)
              );
            }

            // 6. Claim the campaign. One conditional UPDATE guarded on
            //    `status = 'previewed'`: a concurrent second send loses here,
            //    before it can write a single duplicate notification.
            return claimCampaignForSend(scope, campaign.id).andThen((claimed) => {
              const inbox = audience.userIds.map((userId) => ({
                user_id: userId,
                space_id: scope.spaceId,
                campaign_id: claimed.id,
                title: cmd.title,
                body: cmd.body,
              }));

              const log: NewDelivery[] = [
                ...audience.userIds.map((userId) => ({
                  campaign_id: claimed.id,
                  user_id: userId,
                  channel: 'in_app' as const,
                  state: 'delivered' as const,
                })),
                // The opted-out members are recorded, not dropped: the log has
                // to account for the whole considered set, or "delivered equals
                // previewed" is unfalsifiable from the evidence alone.
                ...audience.optedOutUserIds.map((userId) => ({
                  campaign_id: claimed.id,
                  user_id: userId,
                  channel: 'in_app' as const,
                  state: 'suppressed' as const,
                  suppression_reason: 'opted_out' as const,
                })),
              ];

              // 7. In-app first, and in this order. The inbox row is the
              //    delivery; the log row is the evidence of it.
              return insertUserNotifications(inbox)
                .andThen(() => insertDeliveries(log))
                .andThen(() =>
                  // 8. The audit write is part of the send, not a side effect.
                  //    A dispatch that reached residents without a log entry
                  //    would break SPACE-04.
                  insertAuditRow({
                    space_id: scope.spaceId,
                    actor_user_id: scope.userId,
                    action: 'notification.sent',
                    object_type: 'notification_campaign',
                    object_id: claimed.id,
                    prior_state: { status: campaign.status },
                    new_state: {
                      recipients: audience.userIds.length,
                      excludedOptedOut: audience.excludedOptedOut,
                      excludedNoChannel: audience.excludedNoChannel,
                    },
                    reason: cmd.reason,
                  })
                )
                .map(() => {
                  // 9. Push is best effort and off the request path. It cannot
                  //    lose the notification, because the notification has
                  //    already been written.
                  deps.defer(() =>
                    fanOutCampaignPush(
                      {
                        id: claimed.id,
                        space_id: claimed.space_id,
                        title: claimed.title,
                        body: claimed.body,
                      },
                      audience.userIds
                    )
                  );

                  return {
                    campaignId: claimed.id,
                    deliveredRecipients: audience.userIds.length,
                    sentAt: claimed.sent_at ?? new Date().toISOString(),
                    quotaRemaining: Math.max(0, limit - (used + 1)),
                  };
                });
            });
          });
        });
      });
    })
  );
}

/** One row of the composer's history list. */
export interface SentCampaignSummary {
  id: string;
  title: string;
  sentAt: string;
  recipients: number;
  suppressed: number;
}

export interface SentCampaignsResponse {
  campaigns: SentCampaignSummary[];
  /**
   * Composer state 0 renders the exhausted block before any preview exists, so
   * it needs the quota here and not only in a preview response. `resetsAt` comes
   * from `nextMonthStartIso()` rather than a second boundary computed locally —
   * two month boundaries that disagree by a day is the bug that export prevents.
   */
  quota: SpaceNotificationQuota;
}

/**
 * Past dispatches plus the current quota — everything the composer needs to
 * render before the admin has costed anything.
 *
 * Gated on `notification.send`: the history is a record of what an admin did
 * with the send capability, and there is no separate read capability for it.
 */
export function listSentCampaigns(
  session: Session,
  rawSpaceId: string
): ResultAsync<SentCampaignsResponse, AppError> {
  return authorize(session, rawSpaceId, 'notification.send').andThen((scope) =>
    ResultAsync.combine([
      listCampaignsForSpace(scope, PAST_CAMPAIGNS_LIMIT),
      countCampaignsSentThisMonth(scope),
      readSpaceQuota(scope),
    ] as const).andThen(([campaigns, used, limit]) =>
      okAsync({
        campaigns: campaigns.map((row) => ({
          id: row.id,
          title: row.title,
          // Only `sent` rows are listed, so `sent_at` is set; the coalesce is
          // for the column's nullable type, not for a case that can occur.
          sentAt: row.sent_at ?? row.previewed_at,
          recipients: row.audience_size,
          suppressed: row.excluded_opted_out,
        })),
        quota: { used, limit, resetsAt: nextMonthStartIso() },
      })
    )
  );
}
