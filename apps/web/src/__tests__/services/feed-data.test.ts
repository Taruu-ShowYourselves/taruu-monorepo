/**
 * Feed assembly tests
 *
 * buildFeedItems - flattening votes plus Knesset metadata into the stream,
 * and in particular that the evidence the desk already gathered (editorial
 * ranking, press refs, official document summary) survives the trip to the
 * feed card instead of being dropped on the floor.
 */

import { describe, it, expect } from 'vitest';
import { KNESSET_SCOPE } from '@sync/shared';
import { buildFeedItems } from '@/app/[locale]/feed/feedData';
import type { VoteWithRelations } from '@/components/press/sections/deskData';
import type { KnessetItem, KnessetRanking } from '@/lib/supabase/types';

function vote(id: string, overrides: Partial<VoteWithRelations> = {}) {
  return {
    id,
    creator_id: 'creator',
    title: `נושא ${id}`,
    description: 'תיאור',
    municipality_id: KNESSET_SCOPE,
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

function kItem(voteId: string, overrides: Partial<KnessetItem> = {}) {
  return {
    id: `ki-${voteId}`,
    vote_id: voteId,
    item_id: 1,
    plenum_session_id: 100,
    session_date: '2026-07-13T12:00:00',
    session_number: 417,
    knesset_num: 25,
    item_type: 'הצעת חוק',
    ordinal: 3,
    status_id: null,
    is_discussion: false,
    doc_url: null,
    doc_group: null,
    summary: null,
    summary_model: null,
    source_updated_at: null,
    fetched_at: '2026-07-27T00:00:00Z',
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
    ...overrides,
  } as KnessetItem;
}

function kRanking(voteId: string, overrides: Partial<KnessetRanking> = {}) {
  return {
    id: `kr-${voteId}`,
    vote_id: voteId,
    hotness: 95,
    relevance: 95,
    media: 90,
    headline: 'שירות ביטחון',
    rationale: 'הרציונל של הדסק.',
    media_refs: ['https://www.ynet.co.il/x', 'https://www.mako.co.il/y'],
    media_evidence: { outletsCounted: 7 },
    model: null,
    ranked_at: '2026-08-05T00:00:00Z',
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
    ...overrides,
  } as KnessetRanking;
}

describe('buildFeedItems - official document', () => {
  it('carries the document summary, class and link to the card', () => {
    const [item] = buildFeedItems(
      [vote('v1')],
      [
        kItem('v1', {
          summary: 'תקציר המסמך.',
          doc_url: 'https://fs.knesset.gov.il/doc.pdf',
          doc_group: 'הצעת חוק לקריאה הראשונה',
        }),
      ],
      new Map()
    );

    expect(item.document).toEqual({
      summary: 'תקציר המסמך.',
      docUrl: 'https://fs.knesset.gov.il/doc.pdf',
      docGroup: 'הצעת חוק לקריאה הראשונה',
    });
  });

  it('keeps a link-only document (no summary yet)', () => {
    const [item] = buildFeedItems(
      [vote('v1')],
      [kItem('v1', { doc_url: 'https://fs.knesset.gov.il/doc.pdf' })],
      new Map()
    );

    expect(item.document?.docUrl).toBe('https://fs.knesset.gov.il/doc.pdf');
    expect(item.document?.summary).toBeNull();
  });

  it('reports no document when the item has neither text nor link', () => {
    const [item] = buildFeedItems([vote('v1')], [kItem('v1')], new Map());
    expect(item.document).toBeNull();
  });

  it('reports no document for topics without agenda metadata', () => {
    const [item] = buildFeedItems([vote('v1')], [], new Map());
    expect(item.document).toBeNull();
  });
});

describe('buildFeedItems - editorial ranking', () => {
  it('carries the rationale and verified press refs to the card', () => {
    const [item] = buildFeedItems(
      [vote('v1')],
      [],
      new Map([['v1', kRanking('v1')]])
    );

    expect(item.ranking?.rationale).toBe('הרציונל של הדסק.');
    expect(item.ranking?.mediaRefs).toHaveLength(2);
    expect(item.ranking?.outletsCounted).toBe(7);
    expect(item.heat).toBe(95);
  });
});
