/**
 * Feed ordering - the reader's stream is a product decision, so it gets
 * executable proof rather than living implicitly inside a component.
 */

import { describe, it, expect } from 'vitest';
import { KNESSET_SCOPE } from '@sync/shared';
import {
  localityScore,
  orderFeed,
  withPrompts,
  type RankableEntry,
} from '@/lib/feed/order';

function local(id: string, scope: string, heat: number): RankableEntry {
  return { id, scope, isNational: false, heat };
}

function national(id: string, heat: number): RankableEntry {
  return { id, scope: KNESSET_SCOPE, isNational: true, heat };
}

const ids = (entries: { entry: RankableEntry }[]) => entries.map((e) => e.entry.id);

describe('orderFeed - no stored locality', () => {
  const entries = [
    local('cold', 'חיפה', 10),
    local('hot', 'אשדוד', 90),
    national('mid', 50),
  ];

  it('falls back to pure nationwide heat', () => {
    expect(ids(orderFeed(entries, null))).toEqual(['hot', 'mid', 'cold']);
  });

  it('gives a national item no bonus when there is nothing to be near', () => {
    expect(localityScore(national('mid', 50), null)).toBe(50);
  });
});

describe('orderFeed - with a home municipality', () => {
  const entries = [
    local('home-cold', 'קריית טבעון', 5),
    local('far-hot', 'אשדוד', 95),
    local('near-mid', 'חיפה', 40),
    national('national-cold', 1),
  ];

  const ordered = orderFeed(entries, 'קריית טבעון');

  it('leads with the reader own municipality even when it is the coldest', () => {
    expect(ids(ordered)[0]).toBe('home-cold');
  });

  it('places national items after home and ahead of other towns', () => {
    expect(ids(ordered)[1]).toBe('national-cold');
  });

  it('prefers a nearby town over a hotter distant one', () => {
    const order = ids(ordered);
    expect(order.indexOf('near-mid')).toBeLessThan(order.indexOf('far-hot'));
  });

  it('keeps heatRank on nationwide heat, not on the personalised order', () => {
    const rankById = new Map(ordered.map((o) => [o.entry.id, o.heatRank]));
    expect(rankById.get('far-hot')).toBe(1);
    expect(rankById.get('near-mid')).toBe(2);
    expect(rankById.get('home-cold')).toBe(3);
    expect(rankById.get('national-cold')).toBe(4);
  });

  it('penalises a municipality with no known coordinates', () => {
    const unknown = local('unknown', 'עיר שלא קיימת', 50);
    expect(localityScore(unknown, 'קריית טבעון')).toBe(10);
  });
});

describe('withPrompts', () => {
  const stream = (n: number) =>
    orderFeed(
      Array.from({ length: n }, (_, i) => local(`t${i}`, 'חיפה', 100 - i)),
      null
    );

  it('closes every stream with the end card', () => {
    const cards = withPrompts(stream(3), 5);
    expect(cards.at(-1)?.kind).toBe('end');
  });

  it('never opens with a prompt', () => {
    expect(withPrompts(stream(6), 5)[0]?.kind).toBe('topic');
  });

  it('interleaves a prompt after every N topics', () => {
    const cards = withPrompts(stream(11), 5);
    const kinds = cards.map((card) => card.kind);
    expect(kinds.filter((kind) => kind === 'prompt')).toHaveLength(2);
    expect(kinds[5]).toBe('prompt');
    expect(kinds[11]).toBe('prompt');
  });

  it('does not park a prompt immediately before the end card', () => {
    const cards = withPrompts(stream(5), 5);
    expect(cards.map((card) => card.kind)).toEqual([
      'topic',
      'topic',
      'topic',
      'topic',
      'topic',
      'end',
    ]);
  });

  it('keeps every topic in the stream and in order', () => {
    const ordered = stream(7);
    const cards = withPrompts(ordered, 5);
    const topics = cards.flatMap((card) =>
      card.kind === 'topic' ? [card.item.id] : []
    );
    expect(topics).toEqual(ids(ordered));
  });

  it('gives every card a unique key', () => {
    const cards = withPrompts(stream(12), 5);
    expect(new Set(cards.map((card) => card.key)).size).toBe(cards.length);
  });
});
