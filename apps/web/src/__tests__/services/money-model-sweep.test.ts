/**
 * PAY-08's closing proof - one repo-wide money-model sweep.
 *
 * Three sibling guards already lock one plan's surfaces each:
 *   - `participation-cost-legacy.test.ts` (plan 02.1-03) - the retired rail
 *   - `money-model-copy.test.ts`          (plan 03-04)   - ticker, email, mobile welcome
 *   - `economics-fee-split-copy.test.ts`  (plan 03-05)   - the `/economics` components
 *
 * This one is the union proof, not a fourth copy of them. It names no surface:
 * it walks `apps/web/src` and `apps/mobile/app` and asserts that *no file
 * anywhere* carries a retired money figure, so a page added next month is
 * covered without anyone remembering to extend a list.
 *
 * Three rules shaped the matchers, and a future editor should keep them:
 *
 * 1. **Comments are not UI.** Every file is read through `code()` - the
 *    `dashboard-free-mvp.test.ts` stripper - so prose explaining that ₪3 was
 *    retired is never read back as a live price. `apps/mobile/app/vote/[id].tsx`
 *    relies on this.
 *
 * 2. **Whitespace is not meaning.** JSX wraps Hebrew copy mid-sentence, and
 *    `PricingContent.tsx` splits `אין דמי חבר` across two lines. Sources are
 *    whitespace-normalised before matching, otherwise the negation rule below
 *    would fire on a line break.
 *
 * 3. **A false positive here blocks unrelated work, so match narrowly.** A bare
 *    `70%` appears in CSS-in-JS (`GlassCard`, `CinematicIntro`, `LegalContent`)
 *    and a bare `* 0.7` appears in animation code (`NoiseSignalVisual`,
 *    `ShaderBackground`). Neither is a money claim. So the split matchers are an
 *    explicit list of the Hebrew-adjacent phrases that actually shipped, plus a
 *    multiplication applied to a *currency* value. Likewise `מנוי` is a
 *    substring of `הזדמנויות`, so it is matched only as a standalone Hebrew word.
 *
 * Deliberately out of scope, both recorded as known gaps rather than swept:
 *   - Chain-seal copy on marketing surfaces (`02.1-VALIDATION.md`). Only
 *     money-model claims are PAY-08's.
 *   - The token/investment wording on `/economics` and `/coin`. That is COIN-04,
 *     gated on COIN-01's written legal sign-off; plan 03-13 owns it.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// process.cwd() is apps/web when this suite runs.
const REPO = join(process.cwd(), '..', '..');
const WEB_SRC = join(process.cwd(), 'src');
const MOBILE_APP = join(REPO, 'apps', 'mobile', 'app');

/** Never walked: build output, dependencies, and the guards themselves. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.expo', '.turbo', 'dist', 'build', '__tests__']);

/**
 * Generated from the live database enums and never hand-edited. Its `provider`
 * union still carries historical values, which is correct and must not be
 * "fixed" by a copy sweep. Skipping types.ts keeps that decision intact.
 */
const SKIP_FILES = new Set([join(WEB_SRC, 'lib', 'supabase', 'types.ts')]);

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.(test|spec)\.tsx?$/;

/** Strip // and block comments so prose about a retirement is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Collapse runs of whitespace so a JSX line wrap cannot hide or fake a phrase. */
function normalise(source: string): string {
  return source.replace(/\s+/g, ' ');
}

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect(full, acc);
      continue;
    }

    if (!SOURCE_FILE.test(entry.name)) continue;
    if (TEST_FILE.test(entry.name)) continue;
    if (SKIP_FILES.has(full)) continue;

    acc.push(full);
  }
  return acc;
}

interface Surface {
  /** Repo-relative, so a failure message is something a human can open. */
  readonly file: string;
  readonly source: string;
}

function surfacesUnder(root: string): Surface[] {
  return collect(root).map((full) => ({
    file: relative(REPO, full),
    source: normalise(code(readFileSync(full, 'utf8'))),
  }));
}

// Fail loudly if the web tree has moved: without this every `toEqual([])` below
// would pass vacuously over an empty walk.
expect(existsSync(WEB_SRC)).toBe(true);
const WEB_SURFACES = surfacesUnder(WEB_SRC);

const MOBILE_PRESENT = existsSync(MOBILE_APP);
if (!MOBILE_PRESENT) {
  console.warn(
    `[money-model-sweep] ${MOBILE_APP} does not resolve - the mobile app is NOT covered by this run. ` +
      'If the app still exists, this path is stale and must be corrected.'
  );
}
const MOBILE_SURFACES = MOBILE_PRESENT ? surfacesUnder(MOBILE_APP) : [];

const SURFACES = [...WEB_SURFACES, ...MOBILE_SURFACES];

interface Matcher {
  /** What a human sees in the failure diff. */
  readonly phrase: string;
  readonly match: RegExp;
}

interface Violation {
  readonly file: string;
  readonly phrase: string;
}

function sweep(matchers: readonly Matcher[]): Violation[] {
  const violations: Violation[] = [];
  for (const surface of SURFACES) {
    for (const matcher of matchers) {
      if (matcher.match.test(surface.source)) {
        violations.push({ file: surface.file, phrase: matcher.phrase });
      }
    }
  }
  return violations;
}

/** Any Hebrew letter, used to match a Hebrew term as a standalone word. */
const HEBREW = '[\\u0590-\\u05FF]';

const RETIRED_PRICES: readonly Matcher[] = [
  // The ₪3 participation fee, retired by cfa5d25. `(?!\d)` so a future ₪30 is
  // not read as a ₪3.
  { phrase: '₪3 (retired participation fee)', match: /₪3(?!\d)/ },
  // The ₪6/month membership, retired outright - PAY-01..05.
  { phrase: '₪6 (retired monthly membership)', match: /₪6(?!\d)/ },
  // The ticker's per-vote accrual claim. Nothing collects money per vote.
  { phrase: '₪2 מכל הצבעה (per-vote accrual)', match: /₪2 מכל הצבעה/ },
  // Membership vocabulary is permitted only as a denial. `אין דמי חבר` on the
  // rate card is true and stays; a bare `דמי חבר` would be the retired product.
  { phrase: 'דמי חבר not negated by אין', match: /(?<!אין )דמי חבר/ },
  {
    phrase: 'מנוי not negated by אין',
    match: new RegExp(`(?<!${HEBREW})(?<!אין )מנוי(?!${HEBREW})`),
  },
];

const RETIRED_SPLIT: readonly Matcher[] = [
  // The 70/30 civic split. No route and no ledger implements it: the payments
  // webhook credits the treasury the full amount, and the only fee-share config
  // in the tree (`services/bags/index.ts`) is never applied by a route.
  { phrase: '70% לקרן (unbacked civic split)', match: /70% לקרן/ },
  { phrase: '70% זורם (unbacked civic split)', match: /70% זורם/ },
  { phrase: '30% לפלטפורמה (unbacked platform split)', match: /30% לפלטפורמה/ },
  { phrase: '30% מממן (unbacked platform split)', match: /30% מממן/ },
  { phrase: '30% תפעול (unbacked platform split)', match: /30% תפעול/ },
  { phrase: '30% מעמלות (unbacked platform split)', match: /30% מעמלות/ },
  // A trading-fee rate nothing charges.
  { phrase: '1% על כל עסקה (unbacked trading fee)', match: /1% על כל עסקה/ },
  // The treasury board used to render this as a ledger figure. A currency
  // multiplied by a bare constant is a number the page invented.
  {
    phrase: 'formatCurrency(... * 0.x) - a split no ledger produces',
    match: /formatCurrency\([^)]*\*\s*0\.\d/,
  },
  { phrase: 'ILS value * 0.x - a split no ledger produces', match: /ILS\s*\*\s*0\.\d/ },
  { phrase: 'agorot value * 0.x - a split no ledger produces', match: /Agorot\s*\*\s*0\.\d/ },
];

describe('the sweep actually walks both trees', () => {
  it('collects the web source tree', () => {
    expect(WEB_SURFACES.length).toBeGreaterThan(100);
  });

  it('collects the mobile app tree', () => {
    expect(MOBILE_PRESENT).toBe(true);
    expect(MOBILE_SURFACES.length).toBeGreaterThan(5);
  });

  it('skips the generated Supabase types, which mirror live database enums', () => {
    const generated = join(WEB_SRC, 'lib', 'supabase', 'types.ts');
    expect(existsSync(generated)).toBe(true);
    expect(SURFACES.some((s) => s.file.endsWith('lib/supabase/types.ts'))).toBe(false);
  });
});

describe('no retired price survives anywhere', () => {
  it('quotes no retired participation or membership fee, in web or mobile source', () => {
    expect(sweep(RETIRED_PRICES)).toEqual([]);
  });
});

describe('no unbacked split survives anywhere', () => {
  it('states no revenue split or trading rate that no route or ledger implements', () => {
    expect(sweep(RETIRED_SPLIT)).toEqual([]);
  });
});

describe('the model is stated where it matters', () => {
  // Negative sweeps alone can be satisfied by deleting every surface. These
  // three assert the model is still stated, so the sweep proves a correction
  // rather than an erasure.
  function read(relPath: string): string {
    const full = join(REPO, relPath);
    expect(existsSync(full)).toBe(true);
    return code(readFileSync(full, 'utf8'));
  }

  it('the rate card still publishes free participation and the ₪50 creation fee', () => {
    const pricing = read('apps/web/src/app/[locale]/pricing/components/PricingContent.tsx');
    expect(pricing).toContain('חינם');
    expect(pricing).toContain('CREATE_VOTE_COST');
  });

  it('the rate card names what funds the civic pool, so a reader need not assume', () => {
    const pricing = normalise(
      read('apps/web/src/app/[locale]/pricing/components/PricingContent.tsx')
    );
    expect(pricing).toContain('BAG');
    expect(pricing).toContain('לא מכספי תושבים');
  });

  it('the FAQ still answers that participation is free', () => {
    const faq = normalise(read('apps/web/src/app/[locale]/faq/data/faqData.ts'));
    expect(faq).toContain('ההשתתפות בהצבעות חינם');
  });

  it('the shared constants still encode free participation and a paid creation', () => {
    const constants = read('packages/shared/src/constants/index.ts');
    expect(constants).toContain('VOTE_PARTICIPATION_COST = 0');
    expect(constants).toContain('CREATE_VOTE_COST = 50');
  });
});
