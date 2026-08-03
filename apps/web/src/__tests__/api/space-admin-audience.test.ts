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
import { errAsync, okAsync } from 'neverthrow';
import { dbError } from '@/server/http/errors';
import { scopeFor } from '../fixtures/space';

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

import {
  listAudienceCandidates,
} from '@/server/infra/supabase/space-notify.repo';
import { usersWithActiveChannel } from '@/server/infra/supabase/push.repo';
import { contentHash, resolveAudience } from '@/server/app/space-admin/audience';

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

beforeEach(() => {
  vi.clearAllMocks();
  everyoneHasAChannel();
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
