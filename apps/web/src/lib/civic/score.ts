/**
 * The shared reading of a civic score.
 *
 * Municipalities, the Knesset and its individual members are all printed on
 * one −100..+100 scale, and every surface that draws that scale reads it
 * through this file. Two copies of "what counts as a positive score" would
 * eventually disagree, and a reader comparing a city with a member would be
 * comparing two different instruments.
 */

import { civicScorePercent } from '@sync/shared/contracts';

export const EM_DASH = '-';

/** A signed score is a direction before it is a number. */
export type Band = 'up' | 'down' | 'flat' | 'none';

/** The dead band is deliberately wide: ±12 on a 200-point scale is noise. */
export function scoreBand(score: number | null): Band {
  if (score === null) return 'none';
  if (score > 12) return 'up';
  if (score < -12) return 'down';
  return 'flat';
}

/** A signed score prints its sign; an unmeasured one prints an em-dash. */
export function formatScore(score: number | null): string {
  return score === null ? EM_DASH : `${score > 0 ? '+' : ''}${score}`;
}

/** Median of the measured values only - an unmeasured subject is not a zero. */
export function median(values: (number | null)[]): number | null {
  const measured = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (measured.length === 0) return null;
  const mid = Math.floor(measured.length / 2);
  return measured.length % 2 === 1
    ? measured[mid]
    : Math.round((measured[mid - 1] + measured[mid]) / 2);
}

/** `part` as a rounded percentage of `whole`; null when there is no whole. */
export function percent(part: number, whole: number | null): string | null {
  return whole && whole > 0 ? `${Math.round((part / whole) * 100)}%` : null;
}

/**
 * Where a score's bar starts on the −100..+100 track and how far it runs.
 *
 * Anchored at zero rather than at the end of the scale: a bar drawn from
 * −100 makes every score above zero look nearly full, which is the opposite
 * of what a signed scale is for. An unmeasured score has no bar at all.
 */
export function trackGeometry(score: number | null): { from: number; span: number } {
  if (score === null) return { from: 50, span: 0 };
  const at = civicScorePercent(score);
  return { from: Math.min(at, 50), span: Math.abs(at - 50) };
}
