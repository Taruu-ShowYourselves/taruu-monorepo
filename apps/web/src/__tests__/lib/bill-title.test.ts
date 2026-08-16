import { describe, expect, it } from 'vitest';
import { formatBillTitle } from '@/lib/knesset/billTitle';
import { topicHeadline } from '@/components/press/sections/deskData';

describe('formatBillTitle', () => {
  it('lifts the instrument out of the headline and into a kicker', () => {
    expect(formatBillTitle('הצעת חוק התקשורת (שידורים), התשפ"ו-2026')).toEqual({
      kicker: 'הצעת חוק',
      headline: 'התקשורת',
      qualifier: 'שידורים',
    });
  });

  it('drops the legislative year, in either dash', () => {
    expect(formatBillTitle('חוק פינוי בינוי, התשפ"ו-2026').headline).toBe('פינוי בינוי');
    expect(formatBillTitle('חוק פינוי בינוי, התשפ״ו–2026').headline).toBe('פינוי בינוי');
  });

  it('reads an amendment number as a tag, not as part of the subject', () => {
    expect(formatBillTitle("חוק הגנת הצרכן (תיקון מס' 74), התשפ\"ו-2026")).toEqual({
      kicker: 'חוק',
      headline: 'הגנת הצרכן',
      qualifier: 'תיקון 74',
    });
  });

  it('keeps what an amendment number was qualifying', () => {
    expect(
      formatBillTitle("חוק שירות ביטחון (תיקון מס' 29 - הוראת שעה), התשפ\"ו-2026")
        .qualifier
    ).toBe('תיקון 29 · הוראת שעה');
  });

  it('recognises the non-bill instruments on the order of the day', () => {
    expect(
      formatBillTitle('הצעה לדיון מהיר בנושא: היעדר מדיניות ממשלתית להתמודדות')
    ).toEqual({
      kicker: 'דיון מהיר',
      headline: 'היעדר מדיניות ממשלתית להתמודדות',
      qualifier: null,
    });
    expect(formatBillTitle('חוק-יסוד: לימוד תורה')).toEqual({
      kicker: 'חוק-יסוד',
      headline: 'לימוד תורה',
      qualifier: null,
    });
  });

  /**
   * The sync truncates long titles, so a citation can arrive with an ellipsis
   * and an orphaned year - which is how a tile ended up printing
   * `(שידורים),... התשפ"ו-2026`.
   */
  it('cleans up a title the sync cut short', () => {
    expect(formatBillTitle('הצעת חוק התקשורת (שידורים),... התשפ"ו-2026')).toEqual({
      kicker: 'הצעת חוק',
      headline: 'התקשורת',
      qualifier: 'שידורים',
    });
  });

  it('discards a clause the truncation cut open', () => {
    expect(
      formatBillTitle('חוק זיכרון הטבח והנצחת הגבורה ביום כ"ב בתשרי (שמחת...')
    ).toEqual({
      kicker: 'חוק',
      headline: 'זיכרון הטבח והנצחת הגבורה ביום כ"ב בתשרי',
      qualifier: null,
    });
  });

  /** Only a *trailing* group qualifies the bill; one mid-title is the subject. */
  it('leaves a parenthetical that is part of the subject alone', () => {
    expect(
      formatBillTitle('חוק הביטוח הלאומי (נוסח משולב) לעניין קצבאות נכות, התשפ"ו-2026')
    ).toEqual({
      kicker: 'חוק',
      headline: 'הביטוח הלאומי (נוסח משולב) לעניין קצבאות נכות',
      qualifier: null,
    });
  });

  it('never returns an empty headline', () => {
    // Instrument plus clause and nothing else: the clause becomes the subject.
    expect(formatBillTitle('הצעת חוק (תיקון), התשפ"ו-2026').headline).toBe('תיקון');
    expect(formatBillTitle('   ').headline).toBe('');
  });

  it('passes through a title that is already a headline', () => {
    expect(formatBillTitle('מכת מכרסמים ותיקנים ברחבי העיר')).toEqual({
      kicker: null,
      headline: 'מכת מכרסמים ותיקנים ברחבי העיר',
      qualifier: null,
    });
  });
});

describe('topicHeadline', () => {
  const topic = {
    id: 'v1',
    title: 'הצעת חוק שירות ביטחון (תיקון מס\' 29), התשפ"ו-2026',
    titleParts: formatBillTitle('הצעת חוק שירות ביטחון (תיקון מס\' 29), התשפ"ו-2026'),
    description: '',
    artUrl: null,
    participantCount: 0,
    endDate: '2026-08-10',
    options: [],
    source: null,
  };
  const ranking = {
    hotness: 90,
    headline: null as string | null,
    relevance: null,
    media: null,
    outletsCounted: null,
    rationale: null,
    mediaRefs: [],
    rankedAt: null,
  };

  it('prefers the ranker headline over the citation split', () => {
    expect(
      topicHeadline(topic, { ...ranking, headline: 'הארכת הוראת השעה לגיוס חובה' })
    ).toBe('הארכת הוראת השעה לגיוס חובה');
  });

  it('falls back to the citation subject when nothing is curated', () => {
    expect(topicHeadline(topic, ranking)).toBe('שירות ביטחון');
    expect(topicHeadline(topic, null)).toBe('שירות ביטחון');
  });

  it('ignores a blank curated headline rather than printing nothing', () => {
    expect(topicHeadline(topic, { ...ranking, headline: '   ' })).toBe('שירות ביטחון');
  });

  it('leaves a municipal title untouched', () => {
    const civic = { ...topic, title: 'זיהום ושפכים בחופי הרחצה', titleParts: null };
    expect(topicHeadline(civic, null)).toBe('זיהום ושפכים בחופי הרחצה');
  });
});
