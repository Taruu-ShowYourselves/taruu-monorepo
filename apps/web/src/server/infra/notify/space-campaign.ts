/**
 * Campaign push fan-out. Runs OFF the request path: the in-app rows are the
 * source of truth and were already written by the time this is handed to
 * `after()`, so a push failure degrades the delivery rather than losing the
 * notification. Nothing in here throws - the caller has already responded.
 */

import { logger } from '@/lib/logger';
import {
  insertDeliveries,
  type NewDelivery,
} from '@/server/infra/supabase/space-notify.repo';
import { sendBatchNotifications } from '@/services/notifications/expo';

/** The four campaign fields a push needs. Deliberately not the whole row. */
export interface CampaignForPush {
  id: string;
  space_id: string;
  title: string;
  body: string;
}

export async function fanOutCampaignPush(
  campaign: CampaignForPush,
  userIds: string[]
): Promise<void> {
  try {
    // Lazy import, exactly as `vote-created.ts` does it: it keeps the admin
    // client out of the eager import graph of the modules that reach this one,
    // so a unit test can import the route without Supabase env configured.
    // This is deliberate - do not hoist it.
    const pushRepo = await import('@/server/infra/supabase/push.repo');

    // Who could be reached at all. The user-level projection, because the
    // delivery log records people and the token list records devices.
    const reachable = await pushRepo.usersWithActiveChannel(userIds).match(
      (users) => users,
      (error) => {
        logger.warn('channel lookup failed for campaign push', {
          campaignId: campaign.id,
          error,
        });
        return new Set<string>();
      }
    );

    const tokens = await pushRepo.activeTokensForUsers(userIds).match(
      (found) => found,
      (error) => {
        logger.warn('push token lookup failed for campaign', {
          campaignId: campaign.id,
          error,
        });
        return [] as string[];
      }
    );

    let deliveredState: NewDelivery['state'] | null = null;
    if (tokens.length > 0) {
      const result = await sendBatchNotifications(tokens, {
        title: campaign.title,
        body: campaign.body,
        data: {
          type: 'space_announcement',
          spaceId: campaign.space_id,
          campaignId: campaign.id,
        },
        channelId: 'votes',
        priority: 'default',
      });
      // Expo dedups to tokens and hands back tickets, so per-person truth is
      // not recoverable from the batch; the row records that the fan-out was
      // accepted for someone who had a channel, and per-device receipts are a
      // separate reconciliation this phase does not attempt.
      deliveredState = result.sent > 0 ? 'delivered' : 'failed';
    }

    // Written even when nobody was reachable - the `no_active_channel` rows are
    // what makes the sent receipt's counts reconcile against `audience_size`.
    // An unconditional early return on an empty token list would drop exactly
    // the evidence that explains a short reach.
    const rows: NewDelivery[] = [
      ...userIds
        .filter((userId) => !reachable.has(userId))
        .map((userId) => ({
          campaign_id: campaign.id,
          user_id: userId,
          channel: 'push' as const,
          state: 'suppressed' as const,
          suppression_reason: 'no_active_channel' as const,
        })),
      ...(deliveredState === null
        ? []
        : userIds
            .filter((userId) => reachable.has(userId))
            .map((userId) => ({
              campaign_id: campaign.id,
              user_id: userId,
              channel: 'push' as const,
              state: deliveredState,
            }))),
    ];

    await insertDeliveries(rows).match(
      () => undefined,
      (error) => {
        logger.warn('campaign push delivery log write failed (non-fatal)', {
          campaignId: campaign.id,
          error,
        });
      }
    );
  } catch (error) {
    logger.warn('space campaign push fan-out failed (non-fatal)', {
      campaignId: campaign.id,
      error: String(error),
    });
  }
}
