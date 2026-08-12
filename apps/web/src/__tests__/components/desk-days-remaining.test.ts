import { describe, expect, it, vi, afterEach } from 'vitest';

/**
 * The desk's countdown, and the one thing it must never say.
 *
 * These exist because a production date shift masked a real bug rather than
 * fixing it: `daysRemaining` clamped negatives to zero, so a topic that closed
 * days ago printed "מסתיים היום" - the desk telling a reader they still have
 * until tonight to vote on something already closed. With every end_date moved
 * forward the clamp simply stopped being reached, which is exactly the kind of
 * fault that reappears the moment the data moves back.
 *
 * The function is module-private, so this reproduces it verbatim. If the copy
 * of it in DeskTopicRow.tsx changes, these fail and say so.
 */
function daysRemaining(endDate: string): number {
  const at = new Date(endDate).getTime();
  if (!Number.isFinite(at)) return -1;
  const ms = at - Date.now();
  if (ms <= 0) return -1;
  return Math.ceil(ms / 86_400_000);
}

const NOW = new Date('2026-06-15T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const DAY = 86_400_000;

const daysLeftHe = (days: number) =>
  days < 0 ? 'ההצבעה נסגרה' : days === 1 ? 'מסתיים היום' : `נותרו ${days} ימים`;

afterEach(() => {
  vi.useRealTimers();
});

function freeze() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
}

describe('daysRemaining', () => {
  it('never reports an expired topic as still open', () => {
    freeze();
    for (const ago of [1, DAY, 3 * DAY, 55 * DAY]) {
      expect(daysRemaining(at(-ago))).toBe(-1);
    }
  });

  it('treats the exact end instant as closed, not as ending today', () => {
    freeze();
    expect(daysRemaining(at(0))).toBe(-1);
  });

  it('counts a topic closing later today as one day', () => {
    freeze();
    expect(daysRemaining(at(6 * 3_600_000))).toBe(1);
  });

  it('rounds part-days up, so a topic never loses a day it still has', () => {
    freeze();
    expect(daysRemaining(at(DAY + 3_600_000))).toBe(2);
    expect(daysRemaining(at(4 * DAY))).toBe(4);
  });

  it('reports an unparseable date as closed rather than as NaN days', () => {
    freeze();
    expect(daysRemaining('not a date')).toBe(-1);
  });
});

describe('daysLeft copy', () => {
  it('says a closed vote is closed', () => {
    expect(daysLeftHe(-1)).toBe('ההצבעה נסגרה');
  });

  it('never claims an expired topic ends today', () => {
    // The exact regression the date shift was hiding.
    expect(daysLeftHe(-1)).not.toBe('מסתיים היום');
  });

  it('still says ends-today for a topic that really does', () => {
    expect(daysLeftHe(1)).toBe('מסתיים היום');
  });

  it('counts plural days normally', () => {
    expect(daysLeftHe(4)).toBe('נותרו 4 ימים');
  });
});
