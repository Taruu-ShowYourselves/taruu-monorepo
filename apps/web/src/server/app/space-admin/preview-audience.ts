import 'server-only';

/**
 * The audience preview (Surface 5, Interaction Contract 3).
 *
 * Resolve the audience once, persist what was resolved, and hand the admin the
 * counts plus a token derived from the message they were shown. Plan 05-09's
 * send re-runs the same resolver and refuses to proceed unless both
 * fingerprints still match — which is the whole of SPACE-08's "delivered
 * recipients equal the previewed authorized audience".
 */

import { ResultAsync } from 'neverthrow';
import type {
  AudiencePreviewResponse,
  PreviewAudienceRequest,
} from '@sync/shared/contracts';
import { contentHash, resolveAudience } from '@/server/app/space-admin/audience';
import { authorize } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import {
  countCampaignsSentThisMonth,
  insertCampaign,
  readSpaceQuota,
} from '@/server/infra/supabase/space-notify.repo';
import type { Session } from '@/services/auth/session';

/**
 * An exhausted quota is deliberately NOT rejected here.
 *
 * State 0 of the composer renders the fields read-only with the send control
 * absent entirely, and it needs the true `{used}/{limit}` pair to render the
 * `המכסה מתאפסת ב־{date}` block at all — a 429 would leave the UI with nothing
 * to display and nothing to explain. The quota is enforced at send time
 * (05-09), against the same database count read here. Please do not "fix" this
 * into a 429; the preview writes no notification and consumes no quota.
 */
export function previewAudience(
  session: Session,
  rawSpaceId: string,
  cmd: PreviewAudienceRequest
): ResultAsync<AudiencePreviewResponse, AppError> {
  return authorize(session, rawSpaceId, 'notification.send').andThen((scope) =>
    ResultAsync.combine([
      resolveAudience(scope, cmd.audienceFilter),
      countCampaignsSentThisMonth(scope),
      readSpaceQuota(scope),
    ] as const).andThen(([audience, quotaUsed, quotaLimit]) =>
      // contentHash returns a bare Promise; lift it into the chain.
      ResultAsync.fromSafePromise(contentHash(cmd)).andThen((hash) =>
        insertCampaign(scope, {
          title: cmd.title,
          body: cmd.body,
          audience_filter: cmd.audienceFilter,
          audience_hash: audience.hash,
          content_hash: hash,
          audience_size: audience.userIds.length,
          excluded_opted_out: audience.excludedOptedOut,
          excluded_no_channel: audience.excludedNoChannel,
          created_by: scope.userId,
          status: 'previewed',
        }).map((campaign) => ({
          campaignId: campaign.id,
          // The token IS the content hash. The composer echoes it back at send
          // time and the server re-derives it, so an edited message cannot be
          // sent against an audience that was costed for a different one.
          previewToken: hash,
          approvedRecipients: audience.userIds.length,
          excludedOptedOut: audience.excludedOptedOut,
          excludedNoChannel: audience.excludedNoChannel,
          quotaUsed,
          quotaLimit,
          computedAt: campaign.previewed_at,
        }))
      )
    )
  );
}
