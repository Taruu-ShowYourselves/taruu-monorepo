import { describe, expect, it } from 'vitest';
import {
  computeIsraeliIdCheckDigit,
  isDocumentDateValid,
  isValidIsraeliId,
  isValidIsraeliLicenseNumber,
  normalizeIsraeliId,
  parseDocumentDate,
} from '../israeliId';

describe('normalizeIsraeliId', () => {
  it('strips formatting and pads to 9 digits', () => {
    expect(normalizeIsraeliId('12345678')).toBe('012345678');
    expect(normalizeIsraeliId('1-2345678-2')).toBe('123456782');
  });

  it('rejects empty and overlong input', () => {
    expect(normalizeIsraeliId('')).toBeNull();
    expect(normalizeIsraeliId('1234567890')).toBeNull();
    expect(normalizeIsraeliId('abc')).toBeNull();
  });
});

describe('isValidIsraeliId', () => {
  // 123456782 is the canonical publicly documented valid test number.
  it('accepts known-valid numbers', () => {
    expect(isValidIsraeliId('123456782')).toBe(true);
  });

  it('accepts numbers completed by the computed check digit', () => {
    for (const prefix of ['00000001', '31337421', '99999999', '20461358']) {
      const check = computeIsraeliIdCheckDigit(prefix);
      expect(check).not.toBeNull();
      expect(isValidIsraeliId(`${prefix}${check}`)).toBe(true);
    }
  });

  it('rejects any single-digit mutation of a valid number', () => {
    const valid = '123456782';
    for (let i = 0; i < valid.length; i += 1) {
      const mutated =
        valid.slice(0, i) +
        String((Number(valid[i]) + 1) % 10) +
        valid.slice(i + 1);
      expect(isValidIsraeliId(mutated)).toBe(false);
    }
  });

  it('rejects the all-zero degenerate case', () => {
    expect(isValidIsraeliId('000000000')).toBe(false);
    expect(isValidIsraeliId('0')).toBe(false);
  });
});

describe('computeIsraeliIdCheckDigit', () => {
  it('computes the digit that validates the prefix', () => {
    expect(computeIsraeliIdCheckDigit('12345678')).toBe(2);
  });

  it('rejects malformed prefixes', () => {
    expect(computeIsraeliIdCheckDigit('1234567')).toBeNull();
    expect(computeIsraeliIdCheckDigit('1234567a')).toBeNull();
  });
});

describe('isValidIsraeliLicenseNumber', () => {
  it('accepts 7-digit numbers with or without formatting', () => {
    expect(isValidIsraeliLicenseNumber('1234567')).toBe(true);
    expect(isValidIsraeliLicenseNumber('123-4567')).toBe(true);
  });

  it('rejects other lengths', () => {
    expect(isValidIsraeliLicenseNumber('123456')).toBe(false);
    expect(isValidIsraeliLicenseNumber('12345678')).toBe(false);
  });
});

describe('parseDocumentDate', () => {
  it('parses dd.mm.yyyy and variants into ISO', () => {
    expect(parseDocumentDate('27.07.2026')).toBe('2026-07-27');
    expect(parseDocumentDate('1/2/2030')).toBe('2030-02-01');
    expect(parseDocumentDate('01-02-2030')).toBe('2030-02-01');
  });

  it('rejects impossible calendar dates and garbage', () => {
    expect(parseDocumentDate('31.02.2026')).toBeNull();
    expect(parseDocumentDate('2026-07-27')).toBeNull();
    expect(parseDocumentDate('not a date')).toBeNull();
  });
});

describe('isDocumentDateValid', () => {
  it('accepts today and future, rejects past and garbage', () => {
    const now = new Date('2026-07-27T12:00:00Z');
    expect(isDocumentDateValid('2026-07-27', now)).toBe(true);
    expect(isDocumentDateValid('2030-01-01', now)).toBe(true);
    expect(isDocumentDateValid('2026-07-26', now)).toBe(false);
    expect(isDocumentDateValid('garbage', now)).toBe(false);
  });
});
