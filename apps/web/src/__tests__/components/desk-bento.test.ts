import { describe, expect, it } from 'vitest';
import {
  APPROVING_KINDS,
  OBJECTING_KINDS,
  reactionSentiment,
} from '@/components/press/reactions';
import { slotVariant } from '@/components/press/sections/deskBento';

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
  it('opens every stretch with the lead, then the wide and the feature', () => {
    expect(slotVariant(0)).toBe('lead');
    expect(slotVariant(1)).toBe('wide');
    expect(slotVariant(2)).toBe('feature');
    expect(slotVariant(6)).toBe('lead');
    expect(slotVariant(7)).toBe('wide');
    expect(slotVariant(8)).toBe('feature');
  });

  it('fills the rest of the stretch with briefs', () => {
    expect([3, 4, 5].map(slotVariant)).toEqual(['brief', 'brief', 'brief']);
  });

  /**
   * A stretch tiles without holes only if its spans add up to whole columns.
   * The desk is three rows at every measure - it was two above 800px until the
   * desktop bento turned out to be a lead block followed by a queue of
   * identical squares - so one row count is the whole contract now.
   *
   * Break it and `grid-auto-flow: column dense` starts leaving gaps in the
   * mosaic. The cell counts below have to match the span rules in
   * ConsensusDesk.module.css; they are the same claim written twice, once
   * where the browser reads it and once where a test can.
   */
  it('tiles a stretch into whole columns over three rows', () => {
    const CELLS_PER_COLUMN = 3;
    // `wide` lies across two columns; the feature runs the full height.
    const cells = { lead: 4, feature: 3, wide: 2, brief: 1 };

    const stretch = Array.from({ length: 6 }, (_, i) => slotVariant(i));
    const used = stretch.reduce((sum, v) => sum + cells[v], 0);

    expect(used % CELLS_PER_COLUMN).toBe(0);
    expect(used / CELLS_PER_COLUMN).toBe(4);
  });
});
