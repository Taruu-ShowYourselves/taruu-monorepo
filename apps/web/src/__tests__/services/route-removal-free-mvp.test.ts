/**
 * Money-route removal guard tests (Issue #37, Slice 4).
 *
 * The approved money-only routes are gone: /pricing and /refund redirect to
 * the FAQ (where the free-participation answer lives), and /economics, /coin
 * and /coin/[id] resolve to the branded localized not-found experience via
 * the [...rest] catch-all.
 *
 * Explicitly out of scope and asserted UNTOUCHED here: /payments/return
 * (still hosts the live vote-creation return leg — Sahar's dependency),
 * /store/** and /treasury/** (pending product decisions).
 *
 * Redirect behavior itself runs inside Next, which this Vitest setup cannot
 * boot — so these are source-level assertions on the route tree and
 * next.config, per the repo's established source-string test pattern.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const APP = join(SRC, 'app/[locale]');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

describe('removed routes', () => {
  it.each(['pricing', 'economics', 'coin', 'refund'])(
    'app/[locale]/%s no longer exists',
    (route) => {
      expect(existsSync(join(APP, route))).toBe(false);
    }
  );

  it('coin/[id] is gone with its parent tree', () => {
    expect(existsSync(join(APP, 'coin/[id]'))).toBe(false);
  });
});

describe('redirects (next.config.ts)', () => {
  const config = code(readFileSync(join(ROOT, 'next.config.ts'), 'utf8'));

  it('sends /he/pricing to the FAQ', () => {
    expect(config).toContain("source: '/he/pricing', destination: '/he/faq'");
  });

  it('sends /he/refund to the FAQ', () => {
    expect(config).toContain("source: '/he/refund', destination: '/he/faq'");
  });

  it('uses temporary redirects during the product transition', () => {
    expect(config).toContain('permanent: false');
    expect(config).not.toContain('permanent: true');
  });

  it('adds no redirects for payments-return, store, or treasury', () => {
    for (const route of ['/payments', '/store', '/treasury']) {
      expect(config).not.toContain(`source: '/he${route}`);
    }
  });
});

describe('localized not-found experience', () => {
  const notFoundPath = join(APP, 'not-found.tsx');
  const catchAllPath = join(APP, '[...rest]/page.tsx');

  it('exists alongside a catch-all that routes unmatched paths into it', () => {
    expect(existsSync(notFoundPath)).toBe(true);
    expect(existsSync(catchAllPath)).toBe(true);
    expect(code(readFileSync(catchAllPath, 'utf8'))).toContain('notFound()');
  });

  const notFound = code(readFileSync(notFoundPath, 'utf8'));

  it('carries the approved Hebrew copy', () => {
    expect(notFound).toContain('העמוד הזה כבר לא כאן');
    expect(notFound).toContain('העמוד שחיפשתם הוסר או הועבר. אפשר לחזור לעמוד הראשי ולהמשיך משם.');
  });

  it('offers a meaningful home link', () => {
    expect(notFound).toContain('חזרה לעמוד הראשי');
    expect(notFound).toContain('href="/he"');
  });

  it('renders the shared press chrome', () => {
    expect(notFound).toContain('<Header');
    expect(notFound).toContain('<Footer');
    expect(notFound).toContain('<h1');
  });

  it('contains no price or payment wording', () => {
    for (const term of ['₪', 'תשלום', 'מחיר', 'עלות']) {
      expect(notFound).not.toContain(term);
    }
  });
});

describe('excluded routes remain untouched', () => {
  it.each([
    'payments/return/page.tsx',
    'store/page.tsx',
    'treasury/page.tsx',
  ])('app/[locale]/%s still exists', (rel) => {
    expect(existsSync(join(APP, rel))).toBe(true);
  });
});

describe('no live navigation references to the deleted routes', () => {
  // Dead, unrendered files are excluded rather than edited (out of Slice-4
  // scope): the legacy Header.tsx/Footer.tsx (aliased away by their index.ts)
  // and the orphaned components/sections tree.
  const EXCLUDED = [
    `${join(SRC, '__tests__')}`,
    `${join(SRC, 'components/sections')}`,
    join(SRC, 'components/layout/Header/Header.tsx'),
    join(SRC, 'components/layout/Footer/Footer.tsx'),
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (EXCLUDED.some((ex) => p.startsWith(ex))) continue;
      if (entry.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  it('live source links to none of them', () => {
    const patterns = [
      'locale}/pricing',
      'locale}/economics',
      'locale}/coin',
      'locale}/refund',
      "'/pricing'",
      "'/economics'",
      "'/coin'",
      "'/refund'",
    ];
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = code(readFileSync(file, 'utf8'));
      for (const pattern of patterns) {
        if (src.includes(pattern)) offenders.push(`${file} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
