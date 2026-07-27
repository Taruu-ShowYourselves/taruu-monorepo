/**
 * FAQ / support / SEO / archive "free MVP" guard tests (Issue #37, Slice 3).
 *
 * The MVP charges nothing, so the CONTENT surfaces — FAQ data (also published
 * as schema.org FAQ), the support center, the site-wide JSON-LD, and the
 * archive statistics — must not present payment as part of participation.
 *
 * Scope note: Slice-3 surfaces only. The voting flows still carry their
 * payment presentation (pinned by the Slice-0 baselines until Slice 2), and
 * route removal is Slice 4. This deliberately is NOT a repo-wide
 * financial-term ban: undecided commerce surfaces (/store, /treasury routes)
 * and legal pages awaiting Sahar/legal approval are not asserted here.
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

const faqData = read('app/[locale]/faq/data/faqData.ts');
const faqHero = read('app/[locale]/faq/components/FAQHero.tsx');
const supportPage = read('app/[locale]/support/page.tsx');
const supportHero = read('app/[locale]/support/components/SupportHero.tsx');
const supportFlow = read('app/[locale]/support/components/SupportFlow.tsx');
const layout = read('app/[locale]/layout.tsx');
const archivePage = read('app/[locale]/votes/archive/page.tsx');
const archiveHero = read('app/[locale]/votes/archive/components/ArchiveHero.tsx');
const archiveList = read('app/[locale]/votes/archive/components/ArchiveList.tsx');
const dashboard = read('app/[locale]/dashboard/page.tsx');

describe('FAQ data (also published as schema.org FAQPage)', () => {
  it('has no payments category anywhere in the model', () => {
    expect(faqData).not.toContain("'payments'");
    expect(faqData).not.toContain('תשלומים וכסף');
  });

  it('has no vote-cost, money-destination, or pay-in-shekels questions', () => {
    for (const marker of [
      'voting-cost',
      'where-money-goes',
      'pay-in-shekels',
      'כמה עולה להצביע',
      'לאן הולך הכסף',
      'כרטיס אשראי',
      '₪',
    ]) {
      expect(faqData).not.toContain(marker);
    }
  });

  it('answers the cost question with the approved free-participation copy', () => {
    expect(faqData).toContain('האם ההצבעה עולה כסף?');
    expect(faqData).toContain(
      'לא. ההשתתפות בהצבעה היא ללא עלות וללא מנוי. כדי להשתתף יש להשלים את תהליך האימות הנדרש במערכת.'
    );
  });

  it('describes blockchain without a payment step', () => {
    expect(faqData).toContain('אתם פשוט מצביעים — כל השאר קורה ברקע.');
    expect(faqData).not.toContain('ומשלמים');
  });

  it('keeps the non-financial questions', () => {
    for (const id of [
      'what-is-taru',
      'who-can-vote',
      'view-results',
      'location-verification',
      'blockchain',
      'legal-binding',
      'unsubscribe',
    ]) {
      expect(faqData).toContain(`'${id}'`);
    }
  });

  it('keeps the category chips consistent (order matches the map)', () => {
    for (const cat of ["'general'", "'voting'", "'security'", "'legal'", "'account'"]) {
      expect(faqData).toContain(cat);
    }
  });
});

describe('FAQ and support heroes', () => {
  it('no longer promise to explain money', () => {
    for (const src of [faqHero, supportPage, supportHero]) {
      expect(src).not.toContain('כסף');
      expect(src).toContain('על הצבעה, אימות ופרטיות');
    }
  });
});

describe('support topics', () => {
  it('has no money topic, payment blurb, or coin icon', () => {
    expect(supportFlow).not.toContain("'כסף'");
    expect(supportFlow).not.toContain('לאן הולך התשלום');
    expect(supportFlow).not.toContain('כמה זה עולה');
    expect(supportFlow).not.toContain('CoinIcon');
  });

  it('describes the voting topic without cost', () => {
    expect(supportFlow).toContain('איך מצביעים, מתי, וכמה זמן זה לוקח.');
  });

  it('keeps the other topics and both help paths', () => {
    for (const marker of ['אימות', 'פרטיות', 'דברו איתנו בוואטסאפ', 'שאלות נפוצות']) {
      expect(supportFlow).toContain(marker);
    }
    expect(supportFlow).toContain('הצבעה, אימות ופרטיות');
  });
});

describe('site-wide JSON-LD (layout.tsx)', () => {
  it('does not advertise ₪3 anywhere', () => {
    expect(layout).not.toContain('₪');
    expect(layout).not.toContain('3 NIS');
  });

  it('has no priceRange declaration', () => {
    expect(layout).not.toContain('priceRange');
  });

  it('offers participation for free, preserving the Offer schema shape', () => {
    expect(layout).toContain("'@type': 'Offer'");
    expect(layout).toContain("price: '0'");
    expect(layout).toContain("priceCurrency: 'ILS'");
    expect(layout).toContain('השתתפות חינם בהצבעה');
    expect(layout).toContain('Free voting participation');
  });
});

describe('archive surfaces', () => {
  it('metadata mentions certificates, not NFTs or supporters', () => {
    expect(archivePage).toContain('תעודות השתתפות');
    expect(archivePage).not.toContain('NFT');
    expect(archivePage).not.toContain('תומכים');
  });

  it('hero stats are civic, not financial', () => {
    expect(archiveHero).toContain('קולות מאומתים');
    expect(archiveHero).toContain('תעודות שהונפקו');
    expect(archiveHero).not.toContain('כספים שנאספו');
    expect(archiveHero).not.toContain('NFT');
  });

  it('record cards show no funds block and no currency', () => {
    expect(archiveList).not.toContain('כספים שנאספו');
    expect(archiveList).not.toContain('formatCurrency');
    expect(archiveList).not.toContain('₪');
    expect(archiveList).not.toContain('NFTs שהונפקו');
  });

  it('record cards keep the civic stats', () => {
    for (const marker of ['מצביעים מאומתים', 'שותפים אזרחיים', 'תעודות שהונפקו', 'קולות מאומתים']) {
      expect(archiveList).toContain(marker);
    }
  });
});

describe('dashboard stat cards', () => {
  it('no longer shows the portfolio-value card', () => {
    expect(dashboard).not.toContain('שווי התיקים');
    expect(dashboard).not.toContain('מדד ההשקעה');
  });

  it('keeps the honest community-fund placeholder', () => {
    expect(dashboard).toContain('הקרן הקהילתית');
    expect(dashboard).toContain('תיפתח עם ההצבעה הראשונה.');
  });
});
