/**
 * Knesset Day-Order Sync Tests
 *
 * Tests for @/services/knesset - mirroring the plenum agenda
 * (KNS_PlenumSession + KNS_PlmSessionItem) into votable topics.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { KNESSET_SCOPE } from '@sync/shared';

vi.mock('@/lib/supabase/db', () => ({
  createVote: vi.fn(),
  createVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  getKnessetItemByItemId: vi.fn(),
  upsertKnessetItem: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  cronLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createVote,
  createVoteOptions,
  findVoteByMunicipalityAndTitle,
  getKnessetItemByItemId,
  upsertKnessetItem,
} from '@/lib/supabase/db';
import {
  syncKnessetAgenda,
  selectSessions,
  formatSessionDate,
} from '@/services/knesset';
import { parseOrdinal } from '@/services/knesset/odata';

const NOW = new Date('2026-07-27T12:00:00Z');

function session(overrides: Record<string, unknown> = {}) {
  return {
    PlenumSessionID: 2244869,
    Number: 417,
    KnessetNum: 25,
    Name: 'ישיבת מליאה בתאריך 13/07/2026 בשעה 12:00',
    StartDate: '2026-07-13T12:00:00',
    FinishDate: '2026-07-17T05:18:39.23',
    IsSpecialMeeting: false,
    LastUpdatedDate: '2026-07-17T05:19:14.62',
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    plmPlenumSessionID: 900059,
    ItemID: 377036,
    PlenumSessionID: 2244869,
    ItemTypeID: 4,
    ItemTypeDesc: 'הצעה לסדר היום',
    Ordinal: '5',
    Name: 'שיקום קטינים בידי משרד העבודה והרווחה',
    StatusID: 305,
    IsDiscussion: 1,
    LastUpdatedDate: '2026-07-27T10:14:11.397',
    ...overrides,
  };
}

/** Stub the two OData collection fetches: sessions first, then items. */
function stubOData(sessions: unknown[], items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        value: String(url).includes('KNS_PlenumSession') ? sessions : items,
      }),
    }))
  );
}

describe('Knesset OData helpers', () => {
  it('parseOrdinal normalizes strings and rejects junk', () => {
    expect(parseOrdinal('5')).toBe(5);
    expect(parseOrdinal(7)).toBe(7);
    expect(parseOrdinal(null)).toBeNull();
    expect(parseOrdinal('abc')).toBeNull();
  });

  it('formatSessionDate slices the local date without TZ shifts', () => {
    expect(formatSessionDate('2026-07-13T12:00:00')).toBe('13.07.2026');
    expect(formatSessionDate(null)).toBeNull();
    expect(formatSessionDate('garbage')).toBeNull();
  });
});

describe('selectSessions', () => {
  it('keeps sittings inside the recency window and future ones', () => {
    const recent = session({ PlenumSessionID: 1, StartDate: '2026-07-20T11:00:00' });
    const future = session({ PlenumSessionID: 2, StartDate: '2026-08-02T11:00:00' });
    const stale = session({ PlenumSessionID: 3, StartDate: '2026-05-01T11:00:00' });

    const picked = selectSessions([future, recent, stale], NOW);
    expect(picked.map((s) => s.PlenumSessionID)).toEqual([2, 1]);
  });

  it('falls back to the latest sitting during recess', () => {
    const older = session({ PlenumSessionID: 9, StartDate: '2026-03-01T11:00:00' });
    const oldest = session({ PlenumSessionID: 8, StartDate: '2026-02-01T11:00:00' });

    const picked = selectSessions([older, oldest], NOW);
    expect(picked.map((s) => s.PlenumSessionID)).toEqual([9]);
  });

  it('returns nothing when the API returns nothing', () => {
    expect(selectSessions([], NOW)).toEqual([]);
  });
});

describe('syncKnessetAgenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates an active KNESSET_SCOPE vote for a new day-order item', async () => {
    stubOData([session({ StartDate: '2026-07-20T11:00:00' })], [item()]);
    (getKnessetItemByItemId as Mock).mockResolvedValue(null);
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-1' });
    (createVoteOptions as Mock).mockResolvedValue([]);
    (upsertKnessetItem as Mock).mockResolvedValue({ id: 'ki-1' });

    const result = await syncKnessetAgenda();

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([]);
    expect(createVote).toHaveBeenCalledWith(
      expect.objectContaining({
        municipality_id: KNESSET_SCOPE,
        status: 'active',
        title: 'שיקום קטינים בידי משרד העבודה והרווחה',
      })
    );
    expect(createVoteOptions).toHaveBeenCalledWith([
      { vote_id: 'vote-1', text: 'בעד' },
      { vote_id: 'vote-1', text: 'נגד' },
      { vote_id: 'vote-1', text: 'נמנע' },
    ]);
    expect(upsertKnessetItem).toHaveBeenCalledWith(
      expect.objectContaining({
        vote_id: 'vote-1',
        item_id: 377036,
        plenum_session_id: 2244869,
        ordinal: 5,
        is_discussion: true,
      })
    );
  });

  it('refreshes metadata for a known item without creating a vote', async () => {
    stubOData(
      [session({ StartDate: '2026-07-20T11:00:00' })],
      [item({ Ordinal: '2' })]
    );
    (getKnessetItemByItemId as Mock).mockResolvedValue({
      id: 'ki-1',
      vote_id: 'vote-1',
    });
    (upsertKnessetItem as Mock).mockResolvedValue({ id: 'ki-1' });

    const result = await syncKnessetAgenda();

    expect(result.refreshed).toBe(1);
    expect(result.created).toBe(0);
    expect(createVote).not.toHaveBeenCalled();
    expect(upsertKnessetItem).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-1', ordinal: 2 })
    );
  });

  it('skips a new ItemID whose title already has a live ballot', async () => {
    stubOData([session({ StartDate: '2026-07-20T11:00:00' })], [item()]);
    (getKnessetItemByItemId as Mock).mockResolvedValue(null);
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({ id: 'vote-9' });

    const result = await syncKnessetAgenda();

    expect(result.skippedTitleDup).toBe(1);
    expect(result.created).toBe(0);
    expect(createVote).not.toHaveBeenCalled();
  });

  it('ignores items with empty or too-short names', async () => {
    stubOData(
      [session({ StartDate: '2026-07-20T11:00:00' })],
      [item({ Name: null }), item({ ItemID: 2, Name: 'אב' })]
    );

    const result = await syncKnessetAgenda();

    expect(result.itemsSeen).toBe(0);
    expect(result.created).toBe(0);
    expect(createVote).not.toHaveBeenCalled();
  });

  it('collects per-item errors without aborting the run', async () => {
    stubOData(
      [session({ StartDate: '2026-07-20T11:00:00' })],
      [item(), item({ ItemID: 2, Name: 'נושא שני על סדר היום' })]
    );
    (getKnessetItemByItemId as Mock).mockResolvedValue(null);
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ id: 'vote-2' });
    (createVoteOptions as Mock).mockResolvedValue([]);
    (upsertKnessetItem as Mock).mockResolvedValue({ id: 'ki-2' });

    const result = await syncKnessetAgenda();

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('377036');
  });
});
