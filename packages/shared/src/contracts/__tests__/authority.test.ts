import { describe, expect, it } from 'vitest';
import {
  AuthorityKindSchema,
  LOCAL_AUTHORITY_KINDS,
  OfficeHolderSchema,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  SubmitOfficialReviewSchema,
} from '../authority';

describe('AuthorityKind', () => {
  it('carries the kinds Israeli local government actually has', () => {
    expect(AuthorityKindSchema.parse('regional_council')).toBe('regional_council');
    expect(AuthorityKindSchema.parse('local_council')).toBe('local_council');
    expect(AuthorityKindSchema.parse('settlement')).toBe('settlement');
  });

  it('keeps the national scope out of the local kinds', () => {
    expect(LOCAL_AUTHORITY_KINDS).not.toContain('national');
    expect(LOCAL_AUTHORITY_KINDS).toContain('regional_council');
  });
});

describe('OfficeHolderSchema', () => {
  const holder = {
    id: '3f1a0a4e-6b1e-4a4f-9d3c-9a2b7c6d5e4f',
    councilCode: 'קריית טבעון',
    role: 'council_head' as const,
    fullName: 'ראש המועצה',
    termStart: '2023-11-01',
    termEnd: null,
    source: {
      name: 'אתר המועצה',
      url: 'https://example.org/council',
      asOf: '2026-01-01',
    },
    standing: { reviewCount: 0, ratingAverage: null },
  };

  it('accepts a sourced sitting office holder', () => {
    expect(OfficeHolderSchema.parse(holder)).toEqual(holder);
  });

  it('refuses to describe a named person without a source', () => {
    const { source: _source, ...unsourced } = holder;
    expect(() => OfficeHolderSchema.parse(unsourced)).toThrow();
    expect(() =>
      OfficeHolderSchema.parse({ ...holder, source: null })
    ).toThrow();
  });

  it('refuses a source without a real URL', () => {
    expect(() =>
      OfficeHolderSchema.parse({
        ...holder,
        source: { ...holder.source, url: 'somewhere' },
      })
    ).toThrow();
  });

  it('keeps an unreviewed official at null, not at a zero rating', () => {
    const parsed = OfficeHolderSchema.parse(holder);
    expect(parsed.standing.ratingAverage).toBeNull();
    expect(parsed.standing.reviewCount).toBe(0);
  });
});

describe('SubmitOfficialReviewSchema', () => {
  const base = {
    officeHolderId: '3f1a0a4e-6b1e-4a4f-9d3c-9a2b7c6d5e4f',
    rating: 4,
  };

  it('accepts a rating with no words', () => {
    expect(SubmitOfficialReviewSchema.parse(base).rating).toBe(4);
  });

  it('holds the rating inside 1-5', () => {
    expect(() => SubmitOfficialReviewSchema.parse({ ...base, rating: 0 })).toThrow();
    expect(() => SubmitOfficialReviewSchema.parse({ ...base, rating: 6 })).toThrow();
  });

  it('rejects a body too short to say anything', () => {
    expect(() =>
      SubmitOfficialReviewSchema.parse({ ...base, body: 'רע' })
    ).toThrow();
  });

  it('rejects a body past the stored maximum', () => {
    expect(() =>
      SubmitOfficialReviewSchema.parse({ ...base, body: 'א'.repeat(REVIEW_BODY_MAX + 1) })
    ).toThrow();
  });

  it('trims before measuring, so padding cannot fake a body', () => {
    const padded = ` ${'א'.repeat(REVIEW_BODY_MIN - 1)}${' '.repeat(20)}`;
    expect(() =>
      SubmitOfficialReviewSchema.parse({ ...base, body: padded })
    ).toThrow();
  });

  it('carries no residency claim - the server proves that, the client cannot assert it', () => {
    const parsed = SubmitOfficialReviewSchema.parse({
      ...base,
      // @ts-expect-error - deliberately probing for a field that must not exist
      municipality: 'תל אביב-יפו',
    });
    expect(parsed).not.toHaveProperty('municipality');
  });
});
