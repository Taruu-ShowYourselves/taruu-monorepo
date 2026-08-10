import { describe, expect, it } from 'vitest';
import {
  CIVIC_SCORE_MAX,
  CIVIC_SCORE_MIN,
  civicScorePercent,
  MunicipalityCivicStatsSchema,
} from '../municipality';

describe('civicScorePercent', () => {
  it('puts the ends of the scale at the ends of the track', () => {
    expect(civicScorePercent(CIVIC_SCORE_MIN)).toBe(0);
    expect(civicScorePercent(CIVIC_SCORE_MAX)).toBe(100);
  });

  it('puts zero in the middle - the tick a signed score is read against', () => {
    expect(civicScorePercent(0)).toBe(50);
  });

  it('is linear across the scale', () => {
    expect(civicScorePercent(50)).toBe(75);
    expect(civicScorePercent(-50)).toBe(25);
  });

  it('clamps rather than running off the track', () => {
    expect(civicScorePercent(1000)).toBe(100);
    expect(civicScorePercent(-1000)).toBe(0);
  });
});

describe('MunicipalityCivicStatsSchema', () => {
  const base = {
    municipality: 'קריית טבעון',
    kind: 'local_council' as const,
    residents: 18697,
    platformUsers: 412,
    activeParticipants: 180,
    openTopics: 6,
    engagementScore: 12,
    cooperationScore: -34,
    satisfactionScore: null,
    overallScore: 4,
  };

  it('accepts a fully measured municipality', () => {
    expect(MunicipalityCivicStatsSchema.parse(base)).toEqual(base);
  });

  it('accepts null residents - a city with no sourced population figure', () => {
    expect(
      MunicipalityCivicStatsSchema.parse({ ...base, residents: null }).residents
    ).toBeNull();
  });

  it('keeps an unmeasured score null rather than defaulting it to zero', () => {
    const parsed = MunicipalityCivicStatsSchema.parse({
      ...base,
      overallScore: null,
    });
    expect(parsed.overallScore).toBeNull();
  });

  it('rejects a score outside the signed scale', () => {
    expect(() =>
      MunicipalityCivicStatsSchema.parse({ ...base, overallScore: 101 })
    ).toThrow();
    expect(() =>
      MunicipalityCivicStatsSchema.parse({ ...base, engagementScore: -101 })
    ).toThrow();
  });

  it('rejects a negative count', () => {
    expect(() =>
      MunicipalityCivicStatsSchema.parse({ ...base, openTopics: -1 })
    ).toThrow();
  });

  it('carries the authority kind, so a regional council is findable as one', () => {
    expect(
      MunicipalityCivicStatsSchema.parse({ ...base, kind: 'regional_council' }).kind
    ).toBe('regional_council');
  });

  it('rejects the national scope - the dial is local only', () => {
    expect(() =>
      MunicipalityCivicStatsSchema.parse({ ...base, kind: 'national' })
    ).toThrow();
  });
});
