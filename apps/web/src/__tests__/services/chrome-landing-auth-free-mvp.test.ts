/**
 * Chrome / landing / auth "free MVP" guard tests (Issue #37, Slice 1).
 *
 * The MVP charges nothing, so the SHARED CHROME (Masthead = site Header,
 * Colophon = site Footer, Ticker), the LANDING sections (Lead, HowItWorks)
 * and the AUTH pages must not show prices, fee splits, token chips, or
 * money-only navigation.
 *
 * Scope note: Slice-1 surfaces only. The voting flows (ParticipationFlow,
 * votes/create) still carry their payment presentation — pinned by the
 * Slice-0 baselines — and FAQ/support/JSON-LD/routes are later slices.
 * This deliberately is NOT a repo-wide financial-term ban: undecided
 * commerce surfaces (/store, /treasury routes) are not asserted here.
 *
 * Source-string tests (node env, no component rendering available) — same
 * pattern as dashboard-free-mvp.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const read = (rel: string) => code(readFileSync(join(SRC, rel), 'utf8'));

const masthead = read('components/press/Masthead/Masthead.tsx');
const ticker = read('components/press/Ticker/Ticker.tsx');
const lead = read('components/press/sections/Lead.tsx');
const howItWorks = read('components/press/sections/HowItWorks.tsx');
const colophon = read('components/press/sections/Colophon.tsx');
const signIn = read('app/[locale]/sign-in/[[...sign-in]]/page.tsx');
const signUp = read('app/[locale]/sign-up/[[...sign-up]]/page.tsx');
const notifications = read('app/[locale]/settings/notifications/page.tsx');

describe('Masthead (the live site header)', () => {
  it('carries no shekel amounts anywhere', () => {
    expect(masthead).not.toContain('₪');
  });

  it('announces free participation in the edition ear', () => {
    expect(masthead).toContain('קריית טבעון · ההשתתפות חינם');
  });

  it('links to no money-only routes', () => {
    for (const href of ["'coin'", "'economics'", "'treasury'", "'store'", "'pricing'"]) {
      expect(masthead).not.toContain(`href: ${href}`);
    }
    expect(masthead).not.toContain('BAGS');
    expect(masthead).not.toContain('חנות');
    expect(masthead).not.toContain('כלכלה אזרחית');
    expect(masthead).not.toContain('שקיפות הקרן');
  });

  it('keeps the non-financial navigation and actions', () => {
    for (const item of ["{ label: 'הצבעות', href: 'votes' }", "{ label: 'אודות', href: 'about' }", "{ label: 'שאלות נפוצות', href: 'faq' }"]) {
      expect(masthead).toContain(item);
    }
    expect(masthead).toContain('קבוצת המייסדים');
    expect(masthead).toContain('התחברות');
    expect(masthead).toContain('aria-label="תפריט חשבון"');
  });
});

describe('Ticker', () => {
  it('no longer credits vote money to the fund', () => {
    expect(ticker).not.toContain('₪');
    expect(ticker).not.toContain('נצברים לקרן');
  });

  it('announces free participation instead', () => {
    expect(ticker).toContain('ההשתתפות חופשית — כל קול נחתם ונספר');
  });

  it('keeps the other ticker items', () => {
    expect(ticker).toContain('מודדים · מאמתים · מנגישים');
    expect(ticker).toContain('הפיילוט נפתח בקריית טבעון');
  });
});

describe('landing Lead section', () => {
  it('shows no fee or split', () => {
    expect(lead).not.toContain('₪');
    expect(lead).not.toContain('דמי השתתפות');
  });

  it('repurposes the price box as a free-participation stamp', () => {
    expect(lead).toContain('השתתפות');
    expect(lead).toContain('חינם');
    expect(lead).toContain('בלי תשלום · בלי מנוי');
  });

  it('keeps the visual hierarchy (same box, same classes)', () => {
    for (const cls of ['priceBox', 'priceK', 'priceNum', 'priceMeta'] as const) {
      expect(lead).toContain(`styles.${cls}`);
    }
    expect(lead).toContain('עוד בגיליון');
  });
});

describe('landing HowItWorks section', () => {
  it('describes participation without a fee', () => {
    expect(howItWorks).not.toContain('₪');
    expect(howItWorks).toContain('בוחרים עמדה, מאמתים נוכחות — והקול נחתם במערכת.');
  });

  it('keeps all four steps and the footer note', () => {
    for (const no of ["no: '01'", "no: '02'", "no: '03'", "no: '04'"]) {
      expect(howItWorks).toContain(no);
    }
    expect(howItWorks).toContain('כל התהליך לוקח פחות מדקה.');
  });
});

describe('Colophon (the live site footer)', () => {
  it('links to no money-only routes', () => {
    for (const route of ['/pricing', '/economics', '/treasury', '/refund', '/coin', '/store']) {
      expect(colophon).not.toContain(`${route}\``);
    }
    expect(colophon).not.toContain('תמחור');
    expect(colophon).not.toContain('מדיניות החזרים');
    expect(colophon).not.toContain('כלכלה אזרחית');
    expect(colophon).not.toContain('שקיפות הקרן');
  });

  it('keeps the non-financial navigation', () => {
    for (const route of ['/about', '/votes', '/faq', '/support', '/privacy', '/terms']) {
      expect(colophon).toContain(`${route}\``);
    }
  });
});

describe('auth pages (sign-in and sign-up)', () => {
  const pages: Array<[string, string]> = [
    ['sign-in', signIn],
    ['sign-up', signUp],
  ];

  it.each(pages)('%s shows no shekel amounts or fund split', (_name, src) => {
    expect(src).not.toContain('₪');
    expect(src).not.toContain('לקרן הקהילתית');
  });

  it.each(pages)('%s has no token chip', (_name, src) => {
    expect(src).not.toContain('טוקנים');
    expect(src).not.toContain('טוקנ');
  });

  it.each(pages)('%s states participation is without cost', (_name, src) => {
    expect(src).toContain('ההשתתפות בהצבעה — ללא עלות');
  });

  it.each(pages)('%s keeps its non-financial trust content', (_name, src) => {
    expect(src).toContain('מאובטח בבלוקצ׳יין');
    expect(src).toContain('אימות מיקום');
    expect(src).toContain('אימות תושב לפי מיקום');
  });
});

describe('notification settings', () => {
  it('drops the promotional-deals wording', () => {
    expect(notifications).not.toContain('מבצעים');
  });

  it('keeps the product-updates toggle itself', () => {
    expect(notifications).toContain('עדכוני מוצר');
    expect(notifications).toContain('חדשות ופיצ׳רים מתַּרְאוּ.');
  });
});
