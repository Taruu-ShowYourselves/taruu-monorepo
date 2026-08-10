import { describe, expect, it } from 'vitest';
import {
  horizontalCommit,
  resolveSwipe,
  SWIPE_DEADZONE,
  verticalCommit,
} from '@/components/press/sections/voteSwipe';

/** A 1x1 brief on a phone: the smallest tile the gesture has to work on. */
const BRIEF = { width: 179, height: 216 };
/** A 2x2 lead: the largest. */
const LEAD = { width: 367, height: 440 };

describe('resolveSwipe', () => {
  it('says nothing inside the deadzone, in any direction', () => {
    const inside = SWIPE_DEADZONE - 1;
    for (const [dx, dy] of [
      [inside, 0],
      [-inside, 0],
      [0, inside],
      [0, -inside],
    ]) {
      expect(resolveSwipe(dx, dy, BRIEF)).toEqual({ intent: null, progress: 0 });
    }
  });

  it('reads a push toward the reader\'s own side of the scale', () => {
    // Hebrew prints בעד at the right edge, so right is for.
    expect(resolveSwipe(40, 0, BRIEF).intent).toBe('for');
    expect(resolveSwipe(-40, 0, BRIEF).intent).toBe('against');
    // English prints For at the left, and the gesture mirrors with it.
    expect(resolveSwipe(40, 0, BRIEF, false).intent).toBe('against');
    expect(resolveSwipe(-40, 0, BRIEF, false).intent).toBe('for');
  });

  it('sets a topic aside on a push down, and ignores one up', () => {
    expect(resolveSwipe(0, 40, BRIEF).intent).toBe('aside');
    expect(resolveSwipe(0, -40, BRIEF)).toEqual({ intent: null, progress: 0 });
  });

  it('gives the whole gesture to its dominant axis', () => {
    // Mostly sideways is a side, even well off the horizontal - a tile must
    // never tint with a blend of two answers the reader is not casting.
    expect(resolveSwipe(60, 40, BRIEF).intent).toBe('for');
    expect(resolveSwipe(40, 60, BRIEF).intent).toBe('aside');
    // A dead-even diagonal resolves sideways rather than flickering.
    expect(resolveSwipe(50, 50, BRIEF).intent).toBe('for');
  });

  it('reports progress toward the commit distance, clamped at 1', () => {
    const commit = horizontalCommit(BRIEF);
    expect(resolveSwipe(commit / 2, 0, BRIEF).progress).toBeCloseTo(0.5);
    expect(resolveSwipe(commit, 0, BRIEF).progress).toBe(1);
    expect(resolveSwipe(commit * 3, 0, BRIEF).progress).toBe(1);
  });

  it('asks a bigger tile for a bigger push, within limits', () => {
    expect(horizontalCommit(LEAD)).toBeGreaterThan(horizontalCommit(BRIEF));
    // Neither extreme becomes a flick or a haul.
    expect(horizontalCommit({ width: 40, height: 40 })).toBe(56);
    expect(horizontalCommit({ width: 4000, height: 40 })).toBe(128);
    expect(verticalCommit({ width: 40, height: 40 })).toBe(52);
    expect(verticalCommit({ width: 40, height: 4000 })).toBe(112);
  });

  it('never asks for more than the tile it is on', () => {
    // A commit distance longer than the cell would be unreachable inside it.
    for (const box of [BRIEF, LEAD]) {
      expect(horizontalCommit(box)).toBeLessThan(box.width);
      expect(verticalCommit(box)).toBeLessThan(box.height);
    }
  });
});
