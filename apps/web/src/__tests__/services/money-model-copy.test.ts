/**
 * Money-model copy guard tests (plan 03-04).
 *
 * Participation became free in cfa5d25 (2026-07-29) and Phase 02.1 made the
 * free ballot persist, but four surfaces went on quoting a per-vote price:
 * the press Ticker told every homepage and /explore visitor that ₪2 of each
 * vote accrued to the community fund, the vote-created email told a creator
 * each ballot (₪3) accrued into a per-vote pot, the mobile welcome screen
 * advertised ₪3 to vote, and an unmounted MoneyTransparency section rendered
 * a ₪3 → ₪2/₪1 split. Nothing collects money per vote. This suite fails if
 * any of that returns.
 *
 * Guards exactly the four surfaces plan 03-04 owns: the press Ticker, the
 * vote-created email, the mobile welcome screen, and the absence of the
 * retired MoneyTransparency section.
 *
 * Deliberately NOT asserted here:
 *   - The economics fee-split percentages. Those belong to plans 03-05
 *     (/economics) and 03-09 (treasury, pricing). Asserting on them from here
 *     would fail the suite while 03-05 is still in flight, and would reach
 *     into another plan's files.
 *   - The Ticker's hardcoded `1,247 קולות מאומתים נחתמו השבוע` figure. Not a
 *     money claim, so outside PAY-08's scope; recorded as a known gap.
 *   - The chain-seal copy on marketing surfaces, including the Ticker's own
 *     `חתום בבלוקצ׳יין` line. Recorded as a known gap by 02.1-VALIDATION.md;
 *     only money-model claims are in PAY-08's scope.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed and the include glob never collects
 * `.tsx`), so - same pattern as dashboard-free-mvp.test.ts and
 * participation-cost-legacy.test.ts - these assert against SOURCE. Every
 * requirement here is "this string must (not) exist", which is exactly what a
 * regression would reintroduce.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
// process.cwd() is apps/web when this suite runs; walk up to the repo root to
// reach apps/mobile.
const REPO = join(process.cwd(), '..', '..');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const TICKER_PATH = join(SRC, 'components/press/Ticker/Ticker.tsx');
const EMAIL_PATH = join(SRC, 'services/email/index.ts');
const SECTIONS_BARREL_PATH = join(SRC, 'components/sections/index.ts');
const MONEY_TRANSPARENCY_DIR = join(SRC, 'components/sections/MoneyTransparency');
const MOBILE_WELCOME_PATH = join(REPO, 'apps/mobile/app/(auth)/index.tsx');

/**
 * Read a source file, failing loudly if it has moved. Without this a repo
 * reshuffle would turn every `not.toContain` below into a silent pass.
 */
function readSurface(path: string): string {
  expect(existsSync(path)).toBe(true);
  return code(readFileSync(path, 'utf8'));
}

const tickerCode = readSurface(TICKER_PATH);
const emailCode = readSurface(EMAIL_PATH);
const sectionsBarrelCode = readSurface(SECTIONS_BARREL_PATH);
const mobileWelcomeCode = readSurface(MOBILE_WELCOME_PATH);

/** The vote-created template only, so sibling templates are not asserted on. */
function voteCreatedTemplate(): string {
  const start = emailCode.indexOf('getVoteCreatedTemplate');
  expect(start).toBeGreaterThan(-1);
  const rest = emailCode.slice(start);
  const end = rest.indexOf('getVoteResultsTemplate');
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe('press Ticker', () => {
  it('quotes no per-vote amount', () => {
    expect(tickerCode).not.toContain('₪2');
    expect(tickerCode).not.toContain('₪3');
  });

  it('makes no claim that money accrues per vote', () => {
    expect(tickerCode).not.toContain('נצברים לקרן');
    expect(tickerCode).not.toContain('מכל הצבעה');
  });

  it('still renders five DEFAULT_ITEMS - corrected, not gutted', () => {
    const array = tickerCode.match(/const DEFAULT_ITEMS = \[([\s\S]*?)\];/);
    expect(array).not.toBeNull();
    const entries = (array as RegExpMatchArray)[1].match(/'[^']*'/g) ?? [];
    expect(entries).toHaveLength(5);
  });
});

describe('vote-created email', () => {
  it('quotes no participation price', () => {
    expect(emailCode).not.toContain('₪3');
  });

  it('no longer claims each ballot accrues into a per-vote pot', () => {
    expect(emailCode).not.toContain('נצבר בקופת ההצבעה');
  });

  it('makes no Issue Coin claim - that mechanism is gated on COIN-01', () => {
    expect(emailCode).not.toContain('Issue Coin');
  });

  it('still names the vote and links to it - edited, not gutted', () => {
    const template = voteCreatedTemplate();
    expect(template).toContain('${params.voteTitle}');
    expect(template).toContain('/votes/${params.voteId}');
  });
});

describe('MoneyTransparency is retired', () => {
  it('no longer exists in the tree', () => {
    expect(existsSync(MONEY_TRANSPARENCY_DIR)).toBe(false);
  });

  it('is not exported from the sections barrel', () => {
    expect(sectionsBarrelCode).not.toContain('MoneyTransparency');
  });
});

describe('mobile welcome screen', () => {
  it('no longer advertises a price to vote', () => {
    expect(mobileWelcomeCode).not.toContain('₪3');
  });

  it('states that voting is free', () => {
    expect(mobileWelcomeCode).toContain('חינם');
  });
});
