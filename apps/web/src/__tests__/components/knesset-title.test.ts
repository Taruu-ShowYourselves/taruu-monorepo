import { describe, expect, it } from 'vitest';
import { structureKnessetTitle } from '@/components/press/CinematicIntro/knesset-title';

describe('structureKnessetTitle', () => {
  it('separates an amendment and year from a bill headline', () => {
    expect(
      structureKnessetTitle(
        "הצעת חוק התכנון והבנייה (תיקון מס' 170), התשפ\"ו-2026"
      )
    ).toEqual({
      kind: 'הצעת חוק',
      headline: 'התכנון והבנייה',
      tags: ['תיקון 170', '2026'],
    });
  });

  it('keeps a meaningful parenthetical as metadata', () => {
    expect(
      structureKnessetTitle(
        "הצעת חוק שירות הקבע בצבא הגנה לישראל (גימלאות) (תיקון מס' 39), התשפ\"ו-2026"
      )
    ).toEqual({
      kind: 'הצעת חוק',
      headline: 'שירות הקבע בצה״ל',
      tags: ['גימלאות', 'תיקון 39', '2026'],
    });
  });

  it('turns a discussion prefix into an editorial kind', () => {
    expect(
      structureKnessetTitle(
        'הצעה לדיון מהיר בנושא: מתווה פיצוי בלתי הוגן לתושבי שכונת נס לגויים בתל אביב'
      )
    ).toEqual({
      kind: 'דיון מהיר',
      headline: 'מתווה פיצוי בלתי הוגן לתושבי שכונת נס לגויים בתל…',
      tags: [],
    });
  });

  it('handles a typographic year separator and recommendation clause', () => {
    expect(
      structureKnessetTitle(
        'חוק חופשה שנתית (תיקון מס\' 17), התשפ\"ו–2026'
      )
    ).toEqual({
      kind: 'חקיקה',
      headline: 'חופשה שנתית',
      tags: ['תיקון 17', '2026'],
    });

    expect(
      structureKnessetTitle(
        'המלצה לבחירת סגן ליושב ראש הכנסת, לפי סעיף 2(א) לתקנון הכנסת.'
      )
    ).toEqual({
      kind: 'המלצת מליאה',
      headline: 'בחירת סגן ליושב ראש הכנסת',
      tags: ['סעיף 2(א) לתקנון הכנסת'],
    });
  });

  it('caps unusually long subjects at a natural word boundary', () => {
    const result = structureKnessetTitle(
      'הצעה רגילה לסדר היום בנושא: אמהות וקריירה ופערי השכר בין נשים לגברים בישראל ובייחוד על רקע מצבי החירום'
    );

    expect(result.kind).toBe('סדר היום');
    expect(result.headline.length).toBeLessThanOrEqual(52);
    expect(result.headline.endsWith('…')).toBe(true);
  });

  it('turns recurring official boilerplate into an editorial headline', () => {
    expect(
      structureKnessetTitle(
        'הצהרת אמונים של חבר הכנסת מוחמד אבו אל היג\'א'
      ).headline
    ).toBe('הצהרת אמונים: ח״כ מוחמד אבו אל היג\'א');

    expect(
      structureKnessetTitle(
        'הצעת חוק שירות הקבע בצבא הגנה לישראל (גימלאות)'
      )
    ).toMatchObject({
      headline: 'שירות הקבע בצה״ל',
      tags: ['גימלאות'],
    });

    expect(
      structureKnessetTitle(
        'הצעת חוק לתיקון פקודת העיריות (מס\' 163), התשפ"ו-2026'
      ).headline
    ).toBe('פקודת העיריות');
  });
});
