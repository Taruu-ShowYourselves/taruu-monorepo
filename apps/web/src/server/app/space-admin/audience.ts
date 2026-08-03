import 'server-only';

/**
 * The ONE place that decides who receives a space notification.
 *
 * Preview and send both call this. If they ever resolve the audience
 * differently, SPACE-08's "delivered equals previewed" guarantee is gone, so
 * there is deliberately no second code path — the send re-runs this function
 * and compares hashes rather than trusting the client's list.
 */

import { ResultAsync } from 'neverthrow';
import type { AudienceFilter } from '@sync/shared/contracts';
import type { SpaceScope } from '@/server/app/space-admin/authorize';
import type { AppError } from '@/server/http/errors';
import { usersWithActiveChannel } from '@/server/infra/supabase/push.repo';
import {
  listAudienceCandidates,
  type AudienceCandidateRow,
} from '@/server/infra/supabase/space-notify.repo';

export interface ResolvedAudience {
  /** Sorted, so the fingerprint below does not depend on row order. */
  readonly userIds: string[];
  /** sha256 of the sorted ids. The equality SPACE-08 promises, made checkable. */
  readonly hash: string;
  readonly excludedOptedOut: number;
  readonly excludedNoChannel: number;
}

/**
 * The opt-out key, and the decision this module settles.
 *
 * `users.notification_settings` is nullable JSONB that today holds
 * `{ newVotes, voteEnding, voteResults, marketing }`, and the existing vote
 * fan-out ignores the column entirely. So a resident who has never opened the
 * settings screen has no stored preference at all.
 *
 * **Null means opted in**, and so does an object that simply lacks the key.
 * Reading absence as a refusal would silently mute every existing resident the
 * first time a space admin sent anything, which is a product change disguised
 * as a default. An explicit `false` is the only value that excludes.
 *
 * This was an open product question and this module settles it; if the product
 * later wants announcements to be opt-IN, that is a migration backfilling the
 * key, not a one-character edit here.
 */
const SPACE_ANNOUNCEMENTS_KEY = 'spaceAnnouncements';

const optedIn = (row: AudienceCandidateRow): boolean =>
  row.notification_settings?.[SPACE_ANNOUNCEMENTS_KEY] !== false;

/**
 * Web Crypto, not `node:crypto`: this runs on Cloudflare Workers, and
 * `server/infra/crypto/hmac.ts` already establishes `crypto.subtle` as the
 * hashing primitive that works there.
 */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resolve the recipient set for one space and one audience filter.
 *
 * Opt-outs are applied here, before the count the admin is shown — not by the
 * caller, and not after the send. `excludedNoChannel` counts recipients who
 * will get the in-app row but no push; they stay in `userIds` because the in-app
 * notification is the delivery of record and the push is best effort.
 */
export function resolveAudience(
  scope: SpaceScope,
  filter: AudienceFilter
): ResultAsync<ResolvedAudience, AppError> {
  return listAudienceCandidates(scope, filter).andThen((candidates) => {
    const included = candidates.filter(optedIn);
    const excludedOptedOut = candidates.length - included.length;
    const userIds = included.map((row) => row.id).sort();

    // One batched channel lookup for the whole audience, never one per user.
    return usersWithActiveChannel(userIds).andThen((reachable) =>
      ResultAsync.fromSafePromise(sha256Hex(userIds.join(','))).map((hash) => ({
        userIds,
        hash,
        excludedOptedOut,
        excludedNoChannel: userIds.filter((id) => !reachable.has(id)).length,
      }))
    );
  });
}

/**
 * Fingerprint of the message itself. This is the `previewToken` the composer
 * echoes back at send time, which is what makes the staleness rule enforceable
 * on the server rather than trusted from the client.
 *
 * A bare `Promise`, not a `ResultAsync` — hashing cannot fail in a way a caller
 * could act on. Inside a Result chain, lift it with
 * `ResultAsync.fromSafePromise(contentHash(cmd))`.
 */
export function contentHash(input: {
  title: string;
  body: string;
  audienceFilter: string;
}): Promise<string> {
  // Trimmed at the edges only: interior whitespace is part of the message the
  // admin approved, so reflowing a paragraph must invalidate the preview.
  return sha256Hex(
    [input.title.trim(), input.body.trim(), input.audienceFilter.trim()].join('\n')
  );
}
