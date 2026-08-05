/**
 * The payments kill switch, seen from the surfaces it has to change - and, just
 * as importantly, from the ones it must NOT.
 *
 * Provider approval has not come through, so `NEXT_PUBLIC_PAYMENTS_ENABLED` ships
 * unset and every paid affordance must render a Hebrew coming-soon state instead
 * of a checkout. The routes are the enforcement point (see api/payments.test.ts,
 * api/payments-refund.test.ts and api/merch-checkout.test.ts); the client is the
 * courtesy, and courtesy is what this file pins.
 *
 * This repo has no component-test setup - vitest runs `environment: 'node'` with
 * a `.ts`-only include glob and @testing-library is not installed - so the client
 * surfaces are asserted against SOURCE, in the `dashboard-free-mvp.test.ts`
 * style. Blunt, but exactly the shape of what a regression would reintroduce.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAYMENTS_ENABLED_VAR,
  PAYMENTS_DISABLED_CODE,
  PAYMENTS_DISABLED_MESSAGE,
  paymentsEnabled,
  paymentsEnabledIn,
} from '@/lib/payments-flag';

const SRC = join(process.cwd(), 'src');

/** Strip // and block comments so prose about the change is not read as code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const read = (relative: string) => code(readFileSync(join(SRC, relative), 'utf8'));

const createPage = read('app/[locale]/votes/create/page.tsx');
const cartView = read('app/[locale]/store/cart/components/CartView.tsx');
const paymentsWebhook = read('app/api/payments/webhook/route.ts');
const merchWebhook = read('app/api/merch/webhook/route.ts');
const participateRoute = read('app/api/votes/[id]/participate/route.ts');
const participationFlow = read('app/[locale]/votes/[id]/flow/submitParticipation.ts');

describe('the flag itself', () => {
  it('is off when the variable is absent', () => {
    expect(paymentsEnabledIn({})).toBe(false);
  });

  it('treats only the exact string "true" as on', () => {
    expect(paymentsEnabledIn({ [PAYMENTS_ENABLED_VAR]: 'true' })).toBe(true);

    for (const value of ['false', 'TRUE', 'True', '1', 'yes', 'on', '', ' true', 'true ', true, 1]) {
      expect(paymentsEnabledIn({ [PAYMENTS_ENABLED_VAR]: value })).toBe(false);
    }
  });

  it('reads the process default as OFF - the shipped state', () => {
    // No stubEnv here on purpose: this is what a plain `vitest run`, a plain
    // `next build` and a plain deploy all see today.
    expect(paymentsEnabled()).toBe(false);
  });

  it('carries a Hebrew message and a stable machine code', () => {
    expect(PAYMENTS_DISABLED_CODE).toBe('PAYMENTS_DISABLED');
    expect(PAYMENTS_DISABLED_MESSAGE).toMatch(/[֐-׿]/);
    // No Latin-script leakage into a resident-facing string.
    expect(PAYMENTS_DISABLED_MESSAGE).not.toMatch(/[A-Za-z]/);
  });

  it('reads NEXT_PUBLIC_PAYMENTS_ENABLED as a literal, so Next can inline it', () => {
    const flagSource = read('lib/payments-flag.ts');
    // A computed key (source[NAME]) is never inlined into the client bundle, so
    // the browser would silently read undefined. Fails closed, but for the wrong
    // reason - and it would mask a genuinely enabled configuration.
    expect(flagSource).toContain('process.env.NEXT_PUBLIC_PAYMENTS_ENABLED');
  });
});

describe('vote creation shows a coming-soon state instead of a checkout', () => {
  it('asks the flag before it renders anything', () => {
    expect(createPage).toContain("from '@/lib/payments-flag'");
    expect(createPage).toContain('paymentsEnabled()');
  });

  it('returns the coming-soon plate before the wizard can be reached', () => {
    expect(createPage).toContain('if (!PAYMENTS_OPEN) {');

    // The guard must sit ahead of the payment plate, not beside it.
    const guardAt = createPage.indexOf('if (!PAYMENTS_OPEN) {\n    return (');
    const receiptAt = createPage.indexOf('<Receipt');
    expect(guardAt).toBeGreaterThan(-1);
    expect(receiptAt).toBeGreaterThan(guardAt);
  });

  it('guards the submit handler as well as the render', () => {
    expect(createPage).toContain('if (!PAYMENTS_OPEN) return;');
  });

  it('says so in Hebrew, and says why', () => {
    expect(createPage).toContain('עוד לא נפתחה');
    expect(createPage).toContain('בקרוב · COMING SOON');
    expect(createPage).toContain('ההשתתפות בהצבעות פתוחה וחינמית');
  });

  it('promises no date', () => {
    for (const date of ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט',
      'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר', 'בשבוע', 'בחודש', 'תוך יומיים']) {
      expect(createPage).not.toContain(date);
    }
  });

  it('collects nothing on the closed state - no email capture, no waitlist', () => {
    // `code()` has already stripped the // markers, so the slice is bounded by
    // real code: the coming-soon guard through to the auth skeleton after it.
    const start = createPage.indexOf('if (!PAYMENTS_OPEN) {');
    const end = createPage.indexOf('if (isLoading) {');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const closedState = createPage.slice(start, end);
    expect(closedState).not.toContain('PressInput');
    expect(closedState).not.toContain('email');
    expect(closedState).not.toContain('newsletter');
    expect(closedState).not.toContain('fetch(');
  });

  it('keeps the paid funnel intact behind the switch, for the day it flips', () => {
    // Deleting the rails would make "turn payments on" a rewrite rather than a
    // one-line change, which is precisely what this flag exists to avoid.
    expect(createPage).toContain('startVoteCreationCheckout');
    expect(createPage).toContain('CREATE_VOTE_COST');
  });
});

describe('the merch cart offers a disabled coming-soon checkout', () => {
  it('asks the flag', () => {
    expect(cartView).toContain("from '@/lib/payments-flag'");
    expect(cartView).toContain('paymentsEnabled()');
  });

  it('disables the checkout control while payments are off', () => {
    expect(cartView).toContain('disabled={submitting || !PAYMENTS_OPEN}');
    expect(cartView).toContain('aria-disabled={!PAYMENTS_OPEN}');
  });

  it('re-labels the control in Hebrew rather than quoting a price it cannot take', () => {
    expect(cartView).toContain('התשלום ייפתח בקרוב');
    expect(cartView).toContain('המעבר לתשלום עדיין לא נפתח');
  });

  it('guards the handler too, so a synthetic click cannot start a checkout', () => {
    expect(cartView).toContain('if (!PAYMENTS_OPEN) return;');
  });
});

describe('webhooks are NOT gated - money already in flight must still land', () => {
  it('the Green Invoice payments webhook never consults the flag', () => {
    expect(paymentsWebhook).not.toContain('payments-flag');
    expect(paymentsWebhook).not.toContain('PAYMENTS_DISABLED');
  });

  it('the merch webhook never consults the flag', () => {
    expect(merchWebhook).not.toContain('payments-flag');
    expect(merchWebhook).not.toContain('PAYMENTS_DISABLED');
  });
});

describe('FREE VOTING IS UNTOUCHED', () => {
  it('the participation route knows nothing about payments', () => {
    expect(participateRoute).not.toContain('payments-flag');
    expect(participateRoute).not.toContain('PAYMENTS_DISABLED');
    expect(participateRoute).not.toContain('paymentsEnabled');
  });

  it('the participation flow knows nothing about payments', () => {
    expect(participationFlow).not.toContain('payments-flag');
    expect(participationFlow).not.toContain('paymentsEnabled');
  });

  it('the flag is read by payment surfaces only', () => {
    // A short, explicit inventory. If a new reader appears it belongs on this
    // list with a reviewer's eyes on it - especially if it sits on a read or a
    // free-participation path.
    const readers = [
      'lib/env.ts',
      'app/api/payments/create/route.ts',
      'app/api/payments/refund/route.ts',
      'app/api/merch/checkout/route.ts',
      'app/[locale]/votes/create/page.tsx',
      'app/[locale]/store/cart/components/CartView.tsx',
      'services/payments/createVoteCheckout.ts',
    ];

    for (const relative of readers) {
      expect(read(relative)).toContain('payments-flag');
    }
  });
});
