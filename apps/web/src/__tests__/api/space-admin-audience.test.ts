/**
 * SPACE-08, first half: the audience resolver and the preview.
 *
 * The guarantee under test is an equality between two sets — the recipients the
 * admin was shown and the recipients who are later delivered to. That equality
 * only holds structurally if one function computes both, and it is only
 * *checkable* if that function fingerprints its output. So the load-bearing
 * assertion in this file is not any single count: it is that the fingerprint is
 * stable across identical calls and moves when the membership moves.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { errAsync, okAsync } from 'neverthrow';
import { AudiencePreviewResponseSchema } from '@sync/shared/contracts';
import { dbError } from '@/server/http/errors';
import { MUNICIPALITY_A, SESSION, SPACE_A, SPACE_B, scopeFor } from '../fixtures/space';

vi.mock('@/server/infra/supabase/space-notify.repo', () => ({
  listAudienceCandidates: vi.fn(),
  countCampaignsSentThisMonth: vi.fn(),
  readSpaceQuota: vi.fn(),
  insertCampaign: vi.fn(),
  findCampaignInScope: vi.fn(),
}));

vi.mock('@/server/infra/supabase/push.repo', () => ({
  activeTokensForUsers: vi.fn(),
  usersWithActiveChannel: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
}));

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

/**
 * The burst gate is stubbed, not exercised. It is a per-isolate `Map` in this
 * deployment and therefore cannot be the quota; the quota assertions below run
 * against the database count instead. Stubbing it also keeps a dozen POSTs to
 * one space id in this file from tripping a limit that is not under test.
 */
const burst = vi.hoisted(() => ({ limited: false }));

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    check: async () => ({ limited: burst.limited, remaining: 9, resetIn: 60_000 }),
    reset: async () => {},
  }),
  createRateLimitResponse: () =>
    new Response(JSON.stringify({ error: 'too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

import {
  countCampaignsSentThisMonth,
  insertCampaign,
  listAudienceCandidates,
  readSpaceQuota,
} from '@/server/infra/supabase/space-notify.repo';
import { usersWithActiveChannel } from '@/server/infra/supabase/push.repo';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { getSessionFromRequest } from '@/services/auth/session';
import { contentHash, resolveAudience } from '@/server/app/space-admin/audience';
import { POST as POST_PREVIEW } from '@/app/api/space-admin/[spaceId]/notifications/preview/route';

const uid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A `users` projection as `listAudienceCandidates` returns it. */
const candidate = (n: number, settings: Record<string, boolean> | null = null) => ({
  id: uid(n),
  notification_settings: settings,
});

function candidatesAre(rows: ReturnType<typeof candidate>[]) {
  (listAudienceCandidates as Mock).mockReturnValue(okAsync(rows));
}

function everyoneHasAChannel() {
  (usersWithActiveChannel as Mock).mockImplementation((ids: string[]) =>
    okAsync(new Set(ids))
  );
}

const CAMPAIGN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PREVIEWED_AT = '2026-08-03T09:00:00.000Z';

/** A `space_notification_campaigns` row as `insertCampaign` returns it. */
const campaignRow = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_ID,
  space_id: SPACE_A,
  created_by: SESSION.userId,
  title: 'עדכון',
  body: 'גוף ההודעה',
  audience_filter: 'all_members',
  audience_hash: 'unset',
  content_hash: 'unset',
  audience_size: 0,
  excluded_opted_out: 0,
  excluded_no_channel: 0,
  status: 'previewed',
  reason: null,
  previewed_at: PREVIEWED_AT,
  sent_at: null,
  ...overrides,
});

/** The caller holds `notification.send` in space A and nothing in space B. */
function grantOnlyInSpaceA(capabilities: string[] = ['notification.send']) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

const previewBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'עדכון',
  body: 'גוף ההודעה',
  audienceFilter: 'all_members',
  ...overrides,
});

const postPreview = (spaceId: string, payload: unknown) =>
  POST_PREVIEW(
    new NextRequest(`http://localhost/api/space-admin/${spaceId}/notifications/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ spaceId }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  burst.limited = false;
  delete process.env.SPACE_ADMIN_ENABLED;
  everyoneHasAChannel();
  candidatesAre([candidate(1), candidate(2)]);
  grantOnlyInSpaceA();
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(2));
  (readSpaceQuota as Mock).mockReturnValue(okAsync(8));
  // Echo the persisted row back, exactly as PostgREST would after an insert.
  (insertCampaign as Mock).mockImplementation((_scope, row) =>
    okAsync(campaignRow(row as Record<string, unknown>))
  );
});

describe('resolveAudience — the single source of truth for recipients', () => {
  it('returns the candidate ids, sorted, so the fingerprint is order-independent', async () => {
    candidatesAre([candidate(3), candidate(1), candidate(2)]);

    const result = await resolveAudience(scopeFor('notification.send'), 'all_members');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().userIds).toEqual([uid(1), uid(2), uid(3)]);
  });

  it('yields the same hash for the same membership arriving in a different order', async () => {
    candidatesAre([candidate(1), candidate(2), candidate(3)]);
    const first = await resolveAudience(scopeFor('notification.send'), 'all_members');

    candidatesAre([candidate(2), candidate(3), candidate(1)]);
    const second = await resolveAudience(scopeFor('notification.send'), 'all_members');

    expect(first._unsafeUnwrap().hash).toBe(second._unsafeUnwrap().hash);
  });

  /**
   * The point of the whole design. Plan 05-09's send re-runs this resolver and
   * compares its hash against the one the preview persisted; if a membership
   * change did not move the hash, that comparison would pass while the
   * delivered set differed from the previewed one.
   */
  it('produces a different hash when exactly one member joins', async () => {
    candidatesAre([candidate(1), candidate(2)]);
    const before = await resolveAudience(scopeFor('notification.send'), 'all_members');

    candidatesAre([candidate(1), candidate(2), candidate(3)]);
    const after = await resolveAudience(scopeFor('notification.send'), 'all_members');

    expect(after._unsafeUnwrap().hash).not.toBe(before._unsafeUnwrap().hash);
  });

  it('excludes a member who opted out of space announcements, and counts them', async () => {
    candidatesAre([
      candidate(1),
      candidate(2, { spaceAnnouncements: false }),
      candidate(3, { spaceAnnouncements: true }),
    ]);

    const audience = (
      await resolveAudience(scopeFor('notification.send'), 'all_members')
    )._unsafeUnwrap();

    expect(audience.userIds).toEqual([uid(1), uid(3)]);
    expect(audience.excludedOptedOut).toBe(1);
  });

  it('treats a null notification_settings as opted IN', async () => {
    candidatesAre([candidate(1, null)]);

    const audience = (
      await resolveAudience(scopeFor('notification.send'), 'all_members')
    )._unsafeUnwrap();

    expect(audience.userIds).toEqual([uid(1)]);
    expect(audience.excludedOptedOut).toBe(0);
  });

  it('treats settings that simply lack the key as opted IN', async () => {
    candidatesAre([candidate(1, { newVotes: true, marketing: false })]);

    const audience = (
      await resolveAudience(scopeFor('notification.send'), 'all_members')
    )._unsafeUnwrap();

    expect(audience.userIds).toEqual([uid(1)]);
    expect(audience.excludedOptedOut).toBe(0);
  });

  it('keeps a member with no active push channel in the audience but counts them', async () => {
    candidatesAre([candidate(1), candidate(2)]);
    (usersWithActiveChannel as Mock).mockReturnValue(okAsync(new Set([uid(1)])));

    const audience = (
      await resolveAudience(scopeFor('notification.send'), 'all_members')
    )._unsafeUnwrap();

    // Still a recipient: the in-app row is written regardless of push state.
    expect(audience.userIds).toEqual([uid(1), uid(2)]);
    expect(audience.excludedNoChannel).toBe(1);
  });

  it('asks for active channels once for the whole audience, never per user', async () => {
    candidatesAre([candidate(1), candidate(2), candidate(3)]);

    await resolveAudience(scopeFor('notification.send'), 'all_members');

    expect(usersWithActiveChannel).toHaveBeenCalledTimes(1);
    expect(usersWithActiveChannel).toHaveBeenCalledWith([uid(1), uid(2), uid(3)]);
  });

  it('passes the scope and the filter straight through to the candidate query', async () => {
    candidatesAre([]);
    const scope = scopeFor('notification.send');

    const audience = (
      await resolveAudience(scope, 'new_members_30d')
    )._unsafeUnwrap();

    expect(listAudienceCandidates).toHaveBeenCalledWith(scope, 'new_members_30d');
    expect(audience.userIds).toEqual([]);
    expect(audience.excludedOptedOut).toBe(0);
    expect(audience.excludedNoChannel).toBe(0);
  });

  it('propagates a repository failure rather than reporting an empty audience', async () => {
    (listAudienceCandidates as Mock).mockReturnValue(
      errAsync(dbError('users.listAudienceCandidates'))
    );

    const result = await resolveAudience(scopeFor('notification.send'), 'all_members');

    // A silent zero here would render as "0 recipients" — indistinguishable
    // from a space that genuinely has none, which is the ambiguity the whole
    // preview exists to remove.
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('DB');
  });
});

describe('contentHash — what makes the composer staleness rule enforceable', () => {
  const base = { title: 'עדכון', body: 'גוף ההודעה', audienceFilter: 'all_members' };

  it('is stable for the same triple', async () => {
    expect(await contentHash(base)).toBe(await contentHash(base));
  });

  it('changes when the title changes', async () => {
    expect(await contentHash({ ...base, title: 'עדכון אחר' })).not.toBe(
      await contentHash(base)
    );
  });

  it('changes when the body changes', async () => {
    expect(await contentHash({ ...base, body: 'גוף אחר' })).not.toBe(
      await contentHash(base)
    );
  });

  it('changes when the audience filter changes', async () => {
    expect(await contentHash({ ...base, audienceFilter: 'new_members_30d' })).not.toBe(
      await contentHash(base)
    );
  });

  it('ignores whitespace at the edges only, so a reformatted body is still a change', async () => {
    expect(await contentHash({ ...base, title: '  עדכון  ' })).toBe(
      await contentHash(base)
    );
    expect(await contentHash({ ...base, body: 'גוף  ההודעה' })).not.toBe(
      await contentHash(base)
    );
  });

  it('is a 64-character lowercase hex digest', async () => {
    expect(await contentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('POST /api/space-admin/[spaceId]/notifications/preview', () => {
  it('returns a body that satisfies the shared contract', async () => {
    const response = await postPreview(SPACE_A, previewBody());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(AudiencePreviewResponseSchema.safeParse(body).success).toBe(true);
  });

  /**
   * The Receipt renders four rows unconditionally, zeros included, because a
   * missing row reads as "not checked" — which is the exact ambiguity the
   * preview exists to remove. A zero-recipient space must still produce four
   * keys, not three plus an omission.
   */
  it('emits all four numeric fields even when every one of them is zero', async () => {
    candidatesAre([]);
    (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(0));

    const body = await (await postPreview(SPACE_A, previewBody())).json();

    expect(Object.keys(body)).toEqual(
      expect.arrayContaining([
        'approvedRecipients',
        'excludedOptedOut',
        'excludedNoChannel',
        'quotaUsed',
      ])
    );
    expect(body.approvedRecipients).toBe(0);
    expect(body.excludedOptedOut).toBe(0);
    expect(body.excludedNoChannel).toBe(0);
    expect(body.quotaUsed).toBe(0);
  });

  it('reports the counts the resolver produced, opt-outs already applied', async () => {
    candidatesAre([
      candidate(1),
      candidate(2, { spaceAnnouncements: false }),
      candidate(3),
    ]);
    (usersWithActiveChannel as Mock).mockReturnValue(okAsync(new Set([uid(1)])));

    const body = await (await postPreview(SPACE_A, previewBody())).json();

    expect(body.approvedRecipients).toBe(2);
    expect(body.excludedOptedOut).toBe(1);
    expect(body.excludedNoChannel).toBe(1);
    expect(body.quotaUsed).toBe(2);
    expect(body.quotaLimit).toBe(8);
  });

  it('persists a previewed campaign carrying both fingerprints and no sent_at', async () => {
    await postPreview(SPACE_A, previewBody());

    expect(insertCampaign).toHaveBeenCalledTimes(1);
    const [, row] = (insertCampaign as Mock).mock.calls[0];
    expect(row.status).toBe('previewed');
    expect(row.sent_at).toBeUndefined();
    expect(row.audience_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.audience_size).toBe(2);
    expect(row.created_by).toBe(SESSION.userId);
  });

  it('returns the persisted row identity — previewToken IS the content hash', async () => {
    const body = await (await postPreview(SPACE_A, previewBody())).json();
    const [, row] = (insertCampaign as Mock).mock.calls[0];

    expect(body.campaignId).toBe(CAMPAIGN_ID);
    expect(body.previewToken).toBe(row.content_hash);
    expect(body.previewToken).toBe(await contentHash(previewBody() as never));
    expect(body.computedAt).toBe(PREVIEWED_AT);
  });

  /**
   * The preview is not the enforcement point. State 0 of the composer renders
   * read-only with no send control at all, and it needs the true counts to say
   * so; the 429 belongs to the send (plan 05-09).
   */
  it('still returns 200 with the true counts when the quota is exhausted', async () => {
    (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(8));

    const response = await postPreview(SPACE_A, previewBody());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.quotaUsed).toBe(8);
    expect(body.quotaLimit).toBe(8);
  });

  it('refuses a caller without notification.send, opaquely', async () => {
    grantOnlyInSpaceA(['proposal.read', 'metrics.read']);

    const response = await postPreview(SPACE_A, previewBody());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(insertCampaign).not.toHaveBeenCalled();
  });

  it('refuses a swapped spaceId with the identical 403 body', async () => {
    const denied = await postPreview(SPACE_B, previewBody());
    grantOnlyInSpaceA([]);
    const unheld = await postPreview(SPACE_A, previewBody());

    expect(denied.status).toBe(403);
    expect(unheld.status).toBe(403);
    // Byte-identical: a swapped id must be indistinguishable from no grant.
    expect(await denied.text()).toBe(await unheld.text());
    expect(listAudienceCandidates).not.toHaveBeenCalled();
  });

  it('rejects a title over 60 characters before touching the database', async () => {
    const response = await postPreview(SPACE_A, previewBody({ title: 'א'.repeat(61) }));

    expect(response.status).toBe(400);
    expect(listAudienceCandidates).not.toHaveBeenCalled();
    expect(insertCampaign).not.toHaveBeenCalled();
  });

  it('rejects a body over 300 characters before touching the database', async () => {
    const response = await postPreview(SPACE_A, previewBody({ body: 'ב'.repeat(301) }));

    expect(response.status).toBe(400);
    expect(listAudienceCandidates).not.toHaveBeenCalled();
    expect(insertCampaign).not.toHaveBeenCalled();
  });

  it('rejects an unknown audience filter', async () => {
    const response = await postPreview(SPACE_A, previewBody({ audienceFilter: 'everyone' }));

    expect(response.status).toBe(400);
    expect(insertCampaign).not.toHaveBeenCalled();
  });

  it('is 401 with no session, before any authorization work', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const response = await postPreview(SPACE_A, previewBody());

    expect(response.status).toBe(401);
    expect(findActiveGrant).not.toHaveBeenCalled();
  });

  it('applies a burst gate that is not the quota', async () => {
    burst.limited = true;

    const response = await postPreview(SPACE_A, previewBody());

    expect(response.status).toBe(429);
    expect(insertCampaign).not.toHaveBeenCalled();
  });
});
