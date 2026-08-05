import { describe, expect, it } from 'vitest';
import {
  APPROVING_KINDS,
  OBJECTING_KINDS,
  reactionSentiment,
} from '@/components/press/reactions';
import { slotVariant } from '@/components/press/sections/DeskTopicRow';

describe('reactionSentiment', () => {
  it('splits the six reaction kinds into approval and objection', () => {
    expect(
      reactionSentiment({ like: 100, love: 10, haha: 5, wow: 2, sad: 3, angry: 20 })
    ).toEqual({ approving: 117, objecting: 23, total: 140 });
  });

  it('assigns every known kind to exactly one bucket', () => {
    const overlap = APPROVING_KINDS.filter((k) => OBJECTING_KINDS.includes(k));
    expect(overlap).toEqual([]);
    // Nothing measured is silently dropped: the buckets cover the whole map.
    const all = Object.fromEntries(
      [...APPROVING_KINDS, ...OBJECTING_KINDS].map((k) => [k, 1])
    );
    const { approving, objecting, total } = reactionSentiment(all);
    expect(approving + objecting).toBe(total);
  });

  it('counts unknown kinds in the total without guessing their valence', () => {
    const { approving, objecting, total } = reactionSentiment({ like: 4, care: 6 });
    expect({ approving, objecting }).toEqual({ approving: 4, objecting: 0 });
    expect(total).toBe(10);
  });

  it('ignores missing, negative and non-numeric tallies', () => {
    expect(
      reactionSentiment({
        like: 5,
        love: -3,
        haha: Number.NaN,
        wow: Number.POSITIVE_INFINITY,
        angry: 'lots' as unknown as number,
      })
    ).toEqual({ approving: 5, objecting: 0, total: 5 });
  });

  it('reports zeros for a topic with no measured reactions', () => {
    expect(reactionSentiment({})).toEqual({ approving: 0, objecting: 0, total: 0 });
  });
});

describe('slotVariant', () => {
  it('opens every stretch with the lead, then the feature', () => {
    expect(slotVariant(0)).toBe('lead');
    expect(slotVariant(1)).toBe('feature');
    expect(slotVariant(6)).toBe('lead');
    expect(slotVariant(7)).toBe('feature');
  });

  it('fills the rest of the stretch with briefs', () => {
    expect([2, 3, 4, 5].map(slotVariant)).toEqual([
      'brief',
      'brief',
      'brief',
      'brief',
    ]);
  });

  /**
   * The bento is two rows deep. A stretch tiles without holes only if its
   * column spans add up: lead 2, feature 1, and four briefs pairing into 2 -
   * five full columns, every cell used.
   */
  it('tiles a stretch into whole columns', () => {
    const CELLS_PER_COLUMN = 2;
    const cells = { lead: 4, feature: 2, brief: 1 };
    const stretch = Array.from({ length: 6 }, (_, i) => slotVariant(i));
    const used = stretch.reduce((sum, v) => sum + cells[v], 0);
    expect(used % CELLS_PER_COLUMN).toBe(0);
    expect(used / CELLS_PER_COLUMN).toBe(5);
  });
});
