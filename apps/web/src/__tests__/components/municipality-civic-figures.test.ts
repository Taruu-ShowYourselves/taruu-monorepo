import { describe, expect, it } from 'vitest';
import {
  EM_DASH,
  formatScore,
  median,
  percent,
  scoreBand,
  trackGeometry,
} from '@/app/[locale]/municipality/[slug]/civicFigures';

describe('scoreBand', () => {
  it('reads a score as a direction, with a dead band around zero', () => {
    expect(scoreBand(40)).toBe('up');
    expect(scoreBand(13)).toBe('up');
    expect(scoreBand(12)).toBe('flat');
    expect(scoreBand(0)).toBe('flat');
    expect(scoreBand(-12)).toBe('flat');
    expect(scoreBand(-13)).toBe('down');
  });

  it('gives an unmeasured score its own band rather than calling it flat', () => {
    expect(scoreBand(null)).toBe('none');
  });
});

describe('formatScore', () => {
  it('prints the sign of a positive score', () => {
    expect(formatScore(18)).toBe('+18');
    expect(formatScore(-18)).toBe('-18');
    expect(formatScore(0)).toBe('0');
  });

  it('prints an em-dash for a score that was never measured', () => {
    expect(formatScore(null)).toBe(EM_DASH);
  });
});

describe('median', () => {
  it('takes the middle of an odd set and the mean of the middle pair', () => {
    expect(median([10, -30, 5])).toBe(5);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('ignores unmeasured entries instead of counting them as zero', () => {
    // With nulls read as 0 the median would be 0, which would put a city
    // scoring +40 barely above "the national middle".
    expect(median([null, null, 40, 60])).toBe(50);
  });

  it('has no median when nothing has been measured', () => {
    expect(median([null, null])).toBeNull();
  });
});

describe('percent', () => {
  it('rounds a share of a known whole', () => {
    expect(percent(1, 3)).toBe('33%');
  });

  it('refuses to compute a share of an unknown or empty population', () => {
    expect(percent(120, null)).toBeNull();
    expect(percent(120, 0)).toBeNull();
  });
});

describe('trackGeometry', () => {
  it('anchors the bar at zero and runs it toward the score', () => {
    expect(trackGeometry(0)).toEqual({ from: 50, span: 0 });
    expect(trackGeometry(100)).toEqual({ from: 50, span: 50 });
    expect(trackGeometry(-100)).toEqual({ from: 0, span: 50 });
    expect(trackGeometry(50)).toEqual({ from: 50, span: 25 });
  });

  it('draws no bar at all for an unmeasured score', () => {
    expect(trackGeometry(null)).toEqual({ from: 50, span: 0 });
  });
});
