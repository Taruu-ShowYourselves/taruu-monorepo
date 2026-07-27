/**
 * Dictionary + structured-data financial-copy BASELINE (Issue #37, Slice 0).
 *
 * CHARACTERIZATION TESTS — they pin the financial copy currently sitting in
 * the i18n dictionaries and in the JSON-LD emitted from [locale]/layout.tsx,
 * so the Slice-3/5 cleanup diff is provable. On cleanup these presence
 * assertions are expected to be INVERTED into absence guards.
 *
 * Verified context this file also documents:
 *  - the runtime locale list is he-only (config.ts), and
 *  - getDictionary ignores its locale argument, so en.json is unreachable;
 *  - only the meta.* keys are ever read from the dictionary (layout.tsx),
 *    so the financial dictionary keys below render NOWHERE today — they are
 *    dead copy being pinned prior to deletion, not live UI.
 *
 * Scoped to Issue #37 surfaces only — this deliberately does NOT sweep the
 * repo for financial terms, so undecided commerce surfaces (/store, /treasury)
 * are not affected by these tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

const he = JSON.parse(readFileSync(join(SRC, 'lib/i18n/dictionaries/he.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(SRC, 'lib/i18n/dictionaries/en.json'), 'utf8'));
const i18nConfig = readFileSync(join(SRC, 'lib/i18n/config.ts'), 'utf8');
const dictionaries = readFileSync(join(SRC, 'lib/i18n/dictionaries.ts'), 'utf8');
const layout = readFileSync(join(SRC, 'app/[locale]/layout.tsx'), 'utf8');

describe('runtime locale reality (constrains the cleanup)', () => {
  it('supports Hebrew only at runtime', () => {
    expect(i18nConfig).toContain("locales: ['he']");
  });

  it('loads only the Hebrew dictionary regardless of locale', () => {
    expect(dictionaries).toContain('he: () =>');
    expect(dictionaries).not.toContain('en: () =>');
  });

  it('reads only the meta block from the dictionary', () => {
    for (const key of ['dict.meta.title', 'dict.meta.description', 'dict.meta.keywords']) {
      expect(layout).toContain(key);
    }
    // No other dictionary section is consumed anywhere in layout.tsx.
    expect(layout).not.toMatch(/dict\.(?!meta\b)\w+/);
  });
});

describe('BASELINE: dead financial dictionary keys (he.json)', () => {
  it('pins the ₪3 hero badge', () => {
    expect(he.hero.badges.price).toBe('₪3 דמי השתתפות לחיזוק הקול הקהילתי');
  });

  it('pins the financial-transparency feature card', () => {
    expect(he.features.items[4].title).toBe('שקיפות כספית מלאה');
    expect(he.features.items[4].description).toContain('₪3');
  });

  it('pins the paid participation step', () => {
    expect(he.howItWorks.steps[2].description).toContain('₪3 דמי השתתפות');
  });

  it('keeps the live meta block free of financial copy', () => {
    const meta = JSON.stringify(he.meta);
    expect(meta).not.toContain('₪');
    expect(meta).not.toContain('תשלום');
    expect(meta).not.toContain('דמי');
  });
});

describe('BASELINE: dead financial dictionary keys (en.json, orphaned file)', () => {
  it('pins the ₪3 hero badge', () => {
    expect(en.hero.badges.price).toBe('₪3 Participation Fee to Strengthen Community Voice');
  });

  it('pins the financial-transparency feature card', () => {
    expect(en.features.items[4].title).toBe('Full Financial Transparency');
    expect(en.features.items[4].description).toContain('₪3');
  });

  it('pins the paid participation step', () => {
    expect(en.howItWorks.steps[2].description).toContain('₪3 fee');
  });
});

describe('structured data advertises free participation (layout.tsx — Slice 3 state)', () => {
  // JSON-LD is emitted on every page; Google rich results surface it.
  // Slice 3 changed the Offer to price '0', rewrote the FAQ answer to the
  // free wording, and deleted priceRange (which has no free notation).
  it('offers voting at a price of 0 ILS', () => {
    expect(layout).toContain("price: '0'");
    expect(layout).not.toContain("price: '3'");
    expect(layout).toContain('השתתפות חינם בהצבעה');
    expect(layout).toContain('Free voting participation');
  });

  it('answers the cost FAQ with free participation in both languages', () => {
    expect(layout).toContain('כמה עולה להשתתף בהצבעה?');
    expect(layout).toContain('ההשתתפות בהצבעה היא ללא עלות וללא מנוי.');
    expect(layout).toContain('Participation is free');
    expect(layout).not.toContain('₪3');
    expect(layout).not.toContain('3 NIS');
  });

  it('declares no priceRange and carries no shekel glyph at all', () => {
    expect(layout).not.toContain('priceRange');
    expect(layout).not.toContain('₪');
  });
});
