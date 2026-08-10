import { describe, expect, it } from 'vitest';
import { ratingToCivicScore, type GovPosition } from '@sync/shared/contracts';
import { officeOfPosition, slugifyName } from '@/services/knesset/roster';
import { prioritizeRollCalls } from '@/services/knesset/rollcalls';
import { parseStance } from '@/services/knesset/odata';
import { topOfficeOf } from '@/server/read/government';
import { normalizeName } from '@/server/infra/supabase/government.repo';
import type { KnsPlenumVote } from '@/services/knesset/odata';

describe('officeOfPosition', () => {
  it('collapses the gendered pairs the Knesset publishes onto one office', () => {
    // 'שר' and 'שרה' are the same job; so are the two spellings of Speaker.
    expect(officeOfPosition(39)).toBe('minister');
    expect(officeOfPosition(57)).toBe('minister');
    expect(officeOfPosition(122)).toBe('speaker');
    expect(officeOfPosition(123)).toBe('speaker');
    expect(officeOfPosition(43)).toBe('mk');
    expect(officeOfPosition(61)).toBe('mk');
  });

  it('reads the offices a citizen would name', () => {
    expect(officeOfPosition(45)).toBe('pm');
    expect(officeOfPosition(41)).toBe('committee_chair');
    expect(officeOfPosition(131)).toBe('opposition_leader');
  });

  it('drops an unknown position rather than inventing an office for it', () => {
    expect(officeOfPosition(999999)).toBeNull();
  });
});

describe('slugifyName', () => {
  it('keeps Hebrew and joins the parts with a dash', () => {
    expect(slugifyName('יאיר לפיד')).toBe('יאיר-לפיד');
  });

  it('drops the quotes and geresh the two Knesset services disagree about', () => {
    expect(slugifyName('משה אבו״ד')).toBe('משה-אבוד');
    expect(slugifyName('אחמד אבו-ריא')).toBe('אחמד-אבו-ריא');
  });
});

describe('normalizeName', () => {
  it('matches the same person across the two id spaces', () => {
    // ParliamentInfo ships first/last separately, the Votes service ships one
    // string, and they disagree about punctuation.
    expect(normalizeName('בנימין אלון')).toBe(normalizeName('בנימין  אלון'));
    expect(normalizeName('אחמד אבו-ריא')).toBe(normalizeName('אחמד אבו ריא'));
    expect(normalizeName('דוד ביטן')).not.toBe(normalizeName('דוד ביטון'));
  });
});

describe('parseStance', () => {
  it('reads the plenum feed\'s three sides', () => {
    expect(parseStance(7)).toBe('for');
    expect(parseStance(8)).toBe('against');
    expect(parseStance(9)).toBe('abstain');
  });

  it("counts 'נוכח' as a recorded presence, not an absence", () => {
    // Present without taking a side: it belongs in the attendance numerator
    // and on neither side of the question.
    expect(parseStance(6)).toBe('abstain');
  });

  it('treats any other code as an absence rather than guessing a side', () => {
    expect(parseStance(1)).toBe('absent');
    expect(parseStance(0)).toBe('absent');
    expect(parseStance(null)).toBe('absent');
  });
});

const call = (voteId: number, itemId: number | null): KnsPlenumVote => ({
  Id: voteId,
  VoteDateTime: '2026-08-01T00:00:00+03:00',
  SessionID: 1,
  ItemID: itemId,
  VoteTitle: null,
  VoteSubject: null,
  VoteStatusDesc: 'מפורסם',
});

describe('prioritizeRollCalls', () => {
  const rows = [call(1, 100), call(2, 200), call(3, null), call(4, 300)];

  it('spends the budget on items the public actually voted on first', () => {
    const picked = prioritizeRollCalls(rows, new Set([300]), new Set(), 2);
    expect(picked.map((row) => row.Id)).toEqual([4, 1]);
  });

  it('skips roll calls already mirrored, so a steady state costs nothing', () => {
    const picked = prioritizeRollCalls(rows, new Set(), new Set([1, 2, 3, 4]), 10);
    expect(picked).toEqual([]);
  });

  it('never exceeds the per-run budget', () => {
    expect(prioritizeRollCalls(rows, new Set(), new Set(), 3)).toHaveLength(3);
  });
});

const position = (office: GovPosition['office']): GovPosition => ({
  office,
  title: office,
  portfolio: null,
  factionName: null,
  knessetNum: 25,
  startDate: null,
  endDate: null,
});

describe('topOfficeOf', () => {
  it('leads with the highest standing office a member holds', () => {
    expect(
      topOfficeOf([position('committee_member'), position('minister'), position('mk')])
    ).toBe('minister');
  });

  it('falls back to the seat itself', () => {
    expect(topOfficeOf([])).toBe('mk');
  });
});

describe('ratingToCivicScore', () => {
  it('anchors the middle of the 1-5 widget on zero, not on +50', () => {
    expect(ratingToCivicScore(3)).toBe(0);
    expect(ratingToCivicScore(5)).toBe(100);
    expect(ratingToCivicScore(1)).toBe(-100);
    expect(ratingToCivicScore(4)).toBe(50);
  });
});
