/**
 * Knesset agenda grouping tests
 *
 * buildKnessetAgenda — grouping national votes into sittings by their
 * knesset_items metadata, ordinal ordering, and the extras bucket.
 */

import { describe, it, expect } from 'vitest';
import {
  buildKnessetAgenda,
  formatAgendaDate,
  weekdayOf,
} from '@/components/press/sections/knessetAgendaData';
import type { VoteWithRelations } from '@/components/press/sections/deskData';
import type { KnessetItem } from '@/lib/supabase/types';

function vote(id: string, overrides: Partial<VoteWithRelations> = {}) {
  return {
    id,
    creator_id: 'creator',
    title: `נושא ${id}`,
    description: 'תיאור',
    municipality_id: 'כנסת ישראל',
    status: 'active',
    start_date: '2026-07-20T00:00:00Z',
    end_date: '2026-08-03T00:00:00Z',
    participant_count: 0,
    resolved_at: null,
    resolution_status: null,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    options: [],
    source: null,
    ...overrides,
  } as VoteWithRelations;
}

function kItem(
  voteId: string,
  sessionId: number,
  ordinal: number | null,
  overrides: Partial<KnessetItem> = {}
) {
  return {
    id: `ki-${voteId}`,
    vote_id: voteId,
    item_id: Number(voteId.replace(/\D/g, '')) || 1,
    plenum_session_id: sessionId,
    session_date: '2026-07-13T12:00:00',
    session_number: 417,
    knesset_num: 25,
    item_type: 'הצעת חוק',
    ordinal,
    status_id: null,
    is_discussion: false,
    source_updated_at: null,
    fetched_at: '2026-07-27T00:00:00Z',
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
    ...overrides,
  } as KnessetItem;
}

describe('buildKnessetAgenda', () => {
  it('groups votes into sittings ordered newest-first, items by ordinal', () => {
    const votes = [vote('v1'), vote('v2'), vote('v3')];
    const items = [
      kItem('v1', 100, 3, { session_date: '2026-07-13T12:00:00' }),
      kItem('v2', 100, 1, { session_date: '2026-07-13T12:00:00' }),
      kItem('v3', 200, 1, { session_date: '2026-07-20T11:00:00' }),
    ];

    const agenda = buildKnessetAgenda(votes, items);

    expect(agenda.sessions.map((s) => s.plenumSessionId)).toEqual([200, 100]);
    expect(agenda.sessions[1].rows.map((r) => r.topic.id)).toEqual(['v2', 'v1']);
    expect(agenda.extras).toEqual([]);
  });

  it('sends votes without agenda metadata to extras', () => {
    const agenda = buildKnessetAgenda(
      [vote('v1'), vote('v9')],
      [kItem('v1', 100, 1)]
    );

    expect(agenda.sessions).toHaveLength(1);
    expect(agenda.extras.map((t) => t.id)).toEqual(['v9']);
  });

  it('handles the all-extras case (no metadata at all)', () => {
    const agenda = buildKnessetAgenda([vote('v1'), vote('v2')], []);

    expect(agenda.sessions).toEqual([]);
    expect(agenda.extras).toHaveLength(2);
  });

  it('sorts null ordinals to the end of a sitting', () => {
    const agenda = buildKnessetAgenda(
      [vote('v1'), vote('v2')],
      [kItem('v1', 100, null), kItem('v2', 100, 2)]
    );

    expect(agenda.sessions[0].rows.map((r) => r.topic.id)).toEqual(['v2', 'v1']);
  });
});

describe('date helpers', () => {
  it('formats the sitting date from the local ISO string', () => {
    expect(formatAgendaDate('2026-07-13T12:00:00')).toBe('13.07.2026');
    // Survives a DB round-trip that appends a UTC offset.
    expect(formatAgendaDate('2026-07-13T12:00:00+00:00')).toBe('13.07.2026');
    expect(formatAgendaDate(null)).toBeNull();
  });

  it('derives the Hebrew weekday without timezone drift', () => {
    // 2026-07-13 is a Monday.
    expect(weekdayOf('2026-07-13T00:30:00')).toBe('יום שני');
    expect(weekdayOf(null)).toBeNull();
  });
});
