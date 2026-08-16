/**
 * `/economics` fee-split copy guard.
 *
 * Guards the four `/economics` components against the unbacked `70% / 30%` revenue split and the `1%`
 * trading-fee rate. Nothing in the codebase implements either - `createDefaultFeeShareConfig`
 * (`services/bags/index.ts:326`) is never applied by a route or a ledger.
 *
 * **Deliberately NOT asserted:** the page's investment language (`בדיוק כמו במניה`,
 * `ה-BAG שווה יותר`) in `FAQ.tsx` and `HeroSection.tsx`. Rewording what the token *is* is COIN-04, gated on
 * COIN-01's written legal sign-off. This guard must stay green both before and after that gate clears.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`, @testing-library is not
 * installed and the include glob never collects `.tsx`), so these assert against component SOURCE -
 * the `dashboard-free-mvp.test.ts` precedent, including its `code()` comment stripper so prose
 * explaining a removal is never read back as live UI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(process.cwd(), 'src/app/[locale]/economics/components');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

function read(file: string): string {
  return readFileSync(join(COMPONENTS, file), 'utf8');
}

function readCode(file: string): string {
  return code(read(file));
}

/** Every `/economics` component that carries money-model copy. Add a fifth here as one line. */
const MONEY_COPY_COMPONENTS = [
  'FAQ.tsx',
  'CTASection.tsx',
  'HowItWorks.tsx',
  'FlywheelDiagram.tsx',
] as const;

describe('no unbacked revenue split', () => {
  it.each(MONEY_COPY_COMPONENTS)(
    '%s states no 70/30 civic split, because no route or ledger implements one',
    (file) => {
      const source = readCode(file);
      expect(source).not.toContain('70%');
      expect(source).not.toContain('30%');
    }
  );
});

describe('no unbacked trading-fee rate', () => {
  it('FlywheelDiagram.tsx quotes no trading-fee rate, because nothing charges one', () => {
    const source = readCode('FlywheelDiagram.tsx');
    expect(source).not.toContain('1% על כל עסקה');
    expect(source).not.toContain('1%');
  });
});

describe('the true figures survive', () => {
  it('FlywheelDiagram.tsx keeps the ₪50 creation row allocated to the platform', () => {
    const source = readCode('FlywheelDiagram.tsx');
    expect(source).toContain('₪50 להצבעה חדשה');
    expect(source).toContain('תפעול הפלטפורמה');
  });

  it('CTASection.tsx still states that participation is free', () => {
    expect(readCode('CTASection.tsx')).toContain('חינם');
  });

  it('FAQ.tsx keeps all nine questions in each locale', () => {
    // The FAQ went i18n on main: nine questions each in HE_FAQS and EN_FAQS.
    const questions = readCode('FAQ.tsx').match(/question: '/g) ?? [];
    expect(questions).toHaveLength(18);
  });
});

describe('COIN-04 boundary is intact', () => {
  // Asserted POSITIVELY, and this is not an endorsement of the claim. It is proof that plan 03-05 did
  // not silently pre-empt a gated decision: rewording what the token *is* belongs to COIN-04, which is
  // blocked on COIN-01's written Israeli legal sign-off. Plan 03-13 flips this assertion once that
  // gate clears. Until then, a diff that quietly rewrote the securities language would fail here.
  it('FAQ.tsx still carries the investment wording that COIN-04 owns', () => {
    expect(readCode('FAQ.tsx')).toContain('בדיוק כמו במניה');
  });
});
