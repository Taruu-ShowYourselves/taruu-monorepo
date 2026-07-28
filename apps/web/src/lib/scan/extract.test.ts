import { describe, expect, it } from 'vitest';
import {
  deriveFields,
  extractDates,
  extractIdCandidates,
  extractLatinNameLines,
} from './extract';

// 123456782 passes the Israeli ID checksum (canonical public test number).
const VALID_ID = '123456782';

describe('extractIdCandidates', () => {
  it('finds plain 9-digit checksum-valid runs', () => {
    expect(extractIdCandidates(`מספר הזהות ${VALID_ID} בתוקף`)).toEqual([VALID_ID]);
  });

  it('finds the grouped 1-7-1 print form', () => {
    expect(extractIdCandidates('1 2345678 2')).toEqual([VALID_ID]);
    expect(extractIdCandidates('1-2345678-2')).toEqual([VALID_ID]);
  });

  it('ignores checksum-invalid numbers and longer digit runs', () => {
    expect(extractIdCandidates('123456789')).toEqual([]);
    expect(extractIdCandidates(`0${VALID_ID}`)).toEqual([]);
  });
});

describe('extractDates', () => {
  it('collects DD.MM.YYYY variants sorted ascending', () => {
    const text = 'בתוקף עד 15.03.2031 נולד 04.04.1974 הונפק 15.03.2021';
    expect(extractDates(text)).toEqual(['1974-04-04', '2021-03-15', '2031-03-15']);
  });

  it('skips impossible dates', () => {
    expect(extractDates('31.02.2026')).toEqual([]);
  });
});

describe('extractLatinNameLines', () => {
  it('keeps license name lines, drops headers and ID token', () => {
    const text = ['רשיון נהיגה', 'DRIVING', 'ISRAELI', 'COHEN', 'DAVID', 'ID'].join('\n');
    expect(extractLatinNameLines(text)).toEqual(['ISRAELI', 'COHEN', 'DAVID']);
  });
});

describe('deriveFields', () => {
  const docText = [
    'תעודת זהות',
    `מספר הזהות 1 2345678 2`,
    'תאריך הלידה 04.04.1974',
    'תאריך הנפקה 15.03.2021',
    'בתוקף עד 15.03.2031',
  ].join('\n');

  it('matches the typed ID and derives min/max dates', () => {
    const fields = deriveFields(docText, VALID_ID);
    expect(fields.idNumberMatched).toBe(true);
    expect(fields.dateOfBirth).toBe('1974-04-04');
    expect(fields.documentExpiry).toBe('2031-03-15');
  });

  it('does not match a different typed ID', () => {
    // 123456790 also passes the checksum but is not on the document.
    expect(deriveFields(docText, '123456790').idNumberMatched).toBe(false);
  });

  it('accepts unpadded typed input (leading-zero IDs)', () => {
    const text = 'מספר הזהות 012345674 בתוקף עד 01.01.2030 נולד 01.01.1990';
    expect(deriveFields(text, '12345674').idNumberMatched).toBe(true);
  });

  it('returns null dates when fewer than two dates are visible', () => {
    const fields = deriveFields('מספר הזהות 123456782 בתוקף עד 01.01.2030', VALID_ID);
    expect(fields.dateOfBirth).toBeNull();
    expect(fields.documentExpiry).toBeNull();
  });
});
