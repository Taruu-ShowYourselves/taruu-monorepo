import 'server-only';

/**
 * Notification data access, scope-typed like every other space repository.
 *
 * Two things about this module are load-bearing rather than stylistic.
 *
 * First, the quota is counted here, from `space_notification_campaigns` rows.
 * It is not a rate limiter. `lib/rate-limit.ts` falls back to an in-process
 * `Map` whenever `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset - which they are
 * in this deployment - and on Cloudflare Workers that map is per-isolate, so N
 * isolates would each hand out a full monthly quota to the same space.
 *
 * Second, no query here touches the device-token table. Channel state belongs
 * to `push.repo.ts`, which already batches it; duplicating that query would be
 * the N+1 it was written to remove. (Phrased without naming the table so the
 * phase's mechanical "queries it directly?" grep cannot mistake this note for
 * the thing it forbids.)
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { AudienceFilter } from '@sync/shared/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { InsertTables, SpaceNotificationCampaign } from '@/lib/supabase/types';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import { conflict, dbError, type AppError } from '@/server/http/errors';

/** The only projection the audience resolver is allowed to see. */
export interface AudienceCandidateRow {
  id: string;
  notification_settings: Record<string, boolean> | null;
}

export type CampaignRow = SpaceNotificationCampaign;

/** Rows the send writes. Both tables are insert-only from the application. */
export type NewUserNotification = InsertTables<'user_notifications'>;
export type NewDelivery = InsertTables<'space_notification_deliveries'>;

/**
 * The losing side of a concurrent send, and of a retry after one succeeded.
 *
 * Lives here rather than in the use-case because the conditional UPDATE below
 * is what detects the condition - the same placement `DECISION_CONFLICT_HE` has
 * in `space-decision.repo.ts`.
 */
export const SEND_CONFLICT_HE = 'ההתראה כבר נשלחה.';

/** Everything the preview supplies; `space_id` comes off the scope, never the caller. */
export type NewCampaign = Omit<
  InsertTables<'space_notification_campaigns'>,
  'id' | 'space_id' | 'previewed_at' | 'sent_at'
>;

/** Hand-written once. A star select would let a future private column join a response. */
const CAMPAIGN_COLUMNS =
  'id, space_id, created_by, title, body, audience_filter, audience_hash, content_hash, audience_size, excluded_opted_out, excluded_no_channel, status, reason, previewed_at, sent_at';

/**
 * The calendar-month boundary, as an ISO instant.
 *
 * This is the TypeScript equivalent of `date_trunc('month', now())` evaluated
 * on the database clock: PostgREST filter values are literals, so the boundary
 * cannot be an SQL expression and has to be computed here. UTC on both sides,
 * so the two agree. The window is a **calendar month** and not a rolling 24
 * hours - the composer copy reads `מכסה חודשית` and the exhausted block names a
 * reset date, which only means anything against a month boundary.
 */
export function currentMonthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** When the quota resets - the `המכסה מתאפסת ב-{date}` instant. */
export function nextMonthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * The candidate pool for one audience filter, before opt-outs are applied.
 *
 * Opt-out filtering deliberately does NOT happen here - it happens inside
 * `resolveAudience`, so that no caller can obtain a candidate list and forget
 * it. This function's job is the space predicate and nothing else.
 *
 * Every branch selects exactly `id, notification_settings`. The `!inner` embed
 * on the participants branch is a join filter, not a projection: its rows are
 * discarded by the mapper, and the two columns above are the only user data
 * this repository is permitted to read.
 */
export function listAudienceCandidates(
  scope: SpaceScope,
  filter: AudienceFilter
): ResultAsync<AudienceCandidateRow[], AppError> {
  const take = ({ data, error }: { data: unknown; error: unknown }) => {
    if (error) throw error;
    return (data ?? []) as AudienceCandidateRow[];
  };

  const query = (() => {
    switch (filter) {
      case 'active_vote_participants':
        return supabaseAdmin
          .from('users')
          .select('id, notification_settings, user_votes!inner(votes!inner(id))')
          .eq('municipality_id', scope.municipalityCode)
          .eq('user_votes.votes.municipality_id', scope.municipalityCode)
          .eq('user_votes.votes.status', 'active')
          .then(take);
      case 'new_members_30d':
        return supabaseAdmin
          .from('users')
          .select('id, notification_settings')
          .eq('municipality_id', scope.municipalityCode)
          .gt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
          .then(take);
      case 'all_members':
        return supabaseAdmin
          .from('users')
          .select('id, notification_settings')
          .eq('municipality_id', scope.municipalityCode)
          .then(take);
    }
  })();

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('users.listAudienceCandidates', cause)
  );
}

/**
 * The quota of record: campaigns this space actually sent in the current
 * calendar month. Backed by `idx_space_campaign_quota (space_id, sent_at)
 * WHERE sent_at IS NOT NULL`.
 *
 * Counted from rows rather than from a request-rate limiter on purpose - see
 * the module header. A previewed-but-unsent campaign costs nothing; only
 * `sent_at` consumes quota.
 */
export function countCampaignsSentThisMonth(
  scope: SpaceScope
): ResultAsync<number, AppError> {
  const query = supabaseAdmin
    .from('space_notification_campaigns')
    .select('id', { head: true, count: 'exact' })
    .eq('space_id', scope.spaceId)
    .gte('sent_at', currentMonthStartIso())
    .then(({ count, error }) => {
      if (error) throw error;
      return count ?? 0;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_campaigns.countSentThisMonth', cause)
  );
}

/** `spaces.notification_monthly_quota` - the ceiling the count above is read against. */
export function readSpaceQuota(scope: SpaceScope): ResultAsync<number, AppError> {
  const query = supabaseAdmin
    .from('spaces')
    .select('notification_monthly_quota')
    .eq('id', scope.spaceId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return (data as { notification_monthly_quota: number } | null)
        ?.notification_monthly_quota ?? 0;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('spaces.readNotificationQuota', cause)
  );
}

/** Persist the previewed campaign. The row is what the send verifies against. */
export function insertCampaign(
  scope: SpaceScope,
  row: NewCampaign
): ResultAsync<CampaignRow, AppError> {
  const query = supabaseAdmin
    .from('space_notification_campaigns')
    .insert({ ...row, space_id: scope.spaceId })
    .select(CAMPAIGN_COLUMNS)
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data as CampaignRow;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_campaigns.insert', cause)
  );
}

/**
 * A campaign, but only if it belongs to the caller's space.
 *
 * The space predicate is in the SQL rather than checked after the fetch, so a
 * campaign id from another space comes back `null` and the caller returns the
 * same opaque 403 as every other denial - never a 404, which would confirm the
 * id exists somewhere.
 */
export function findCampaignInScope(
  scope: SpaceScope,
  campaignId: string
): ResultAsync<CampaignRow | null, AppError> {
  const query = supabaseAdmin
    .from('space_notification_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('id', campaignId)
    .eq('space_id', scope.spaceId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return (data as CampaignRow | null) ?? null;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_campaigns.findInScope', cause)
  );
}

/**
 * Claim the campaign for exactly one sender.
 *
 * The space predicate and the prior state travel in the same UPDATE, so two
 * concurrent sends cannot both proceed: the loser matches zero rows and gets a
 * 409 rather than a second dispatch. `markMerchOrderPaid` has used this idiom
 * in this codebase since the merch rail shipped, and `transitionProposal`
 * repeats it for decisions - a read-then-write or an advisory lock would be
 * worse here, because Supabase arrives through a pooler from Workers where
 * session-scoped lock semantics are not dependable.
 *
 * Claiming happens BEFORE any notification row is written, so the rows can only
 * ever be written by the winner.
 */
export function claimCampaignForSend(
  scope: SpaceScope,
  campaignId: string
): ResultAsync<CampaignRow, AppError> {
  const query = supabaseAdmin
    .from('space_notification_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('space_id', scope.spaceId)
    .eq('status', 'previewed')
    .select(CAMPAIGN_COLUMNS)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return (data as CampaignRow | null) ?? null;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_campaigns.claimForSend', cause)
  ).andThen((row) =>
    row ? okAsync(row) : errAsync<CampaignRow, AppError>(conflict(SEND_CONFLICT_HE))
  );
}

/**
 * The recipients' inboxes. One bulk insert, never one per recipient.
 *
 * An empty list is a no-op rather than a round trip: a campaign whose audience
 * resolved to nobody still claims its quota and still audits, but it has no
 * inbox to write to.
 */
export function insertUserNotifications(
  rows: NewUserNotification[]
): ResultAsync<void, AppError> {
  if (rows.length === 0) return okAsync(undefined);

  const query = supabaseAdmin
    .from('user_notifications')
    .insert(rows)
    .then(({ error }) => {
      if (error) throw error;
      return undefined;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('user_notifications.insertMany', cause)
  );
}

/**
 * Delivery evidence, one row per recipient per channel.
 *
 * `ignoreDuplicates` against `uq_delivery_once` is what makes a retry idempotent
 * instead of a 500: the second attempt at the same (campaign, user, channel)
 * silently does nothing, so a fan-out that is re-run after a partial failure
 * converges rather than exploding on the rows that already landed.
 */
export function insertDeliveries(rows: NewDelivery[]): ResultAsync<void, AppError> {
  if (rows.length === 0) return okAsync(undefined);

  const query = supabaseAdmin
    .from('space_notification_deliveries')
    .upsert(rows, { onConflict: 'campaign_id,user_id,channel', ignoreDuplicates: true })
    .then(({ error }) => {
      if (error) throw error;
      return undefined;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_deliveries.upsertMany', cause)
  );
}

/**
 * Past dispatches for the composer's history list, newest first.
 *
 * Only `sent` campaigns: a previewed-but-abandoned row is a draft the admin
 * never committed to, and showing it as history would misreport what residents
 * received.
 *
 * The delivered and suppressed figures the caller derives from these rows come
 * from `audience_size` / `excluded_opted_out`, which the send has already
 * proved equal to the delivery log - it refuses unless the audience still
 * fingerprints identically, then writes exactly that many rows. Recounting the
 * log instead would mean materialising every delivery row of twenty campaigns
 * to render a header list.
 */
export function listCampaignsForSpace(
  scope: SpaceScope,
  limit: number
): ResultAsync<CampaignRow[], AppError> {
  const query = supabaseAdmin
    .from('space_notification_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('space_id', scope.spaceId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(limit)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as CampaignRow[];
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('space_notification_campaigns.listForSpace', cause)
  );
}
