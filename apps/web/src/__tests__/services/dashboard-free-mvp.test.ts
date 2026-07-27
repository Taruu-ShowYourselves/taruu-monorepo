/**
 * Dashboard "free MVP" guard tests.
 *
 * The MVP charges nothing, so the personal DASHBOARD must not show billing,
 * SYNC tokens, a price on its create-vote button, or a personal contribution
 * ledger.
 *
 * Scope note: these cover the dashboard surface only. The create-vote and
 * participation flows, the payment APIs and the Masthead are deliberately NOT
 * asserted here — they are out of scope for this slice and unchanged.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed), so these assert against the dashboard
 * SOURCE. A blunt instrument, but the right shape here: every requirement is
 * "this string / this fetch must not exist", which is exactly what a regression
 * would reintroduce.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const dashboard = readFileSync(join(SRC, 'app/[locale]/dashboard/page.tsx'), 'utf8');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const dashboardCode = code(dashboard);

describe('dashboard tabs', () => {
  it('no longer offers a חיובים (billing) tab', () => {
    expect(dashboardCode).not.toContain('חיובים');
    expect(dashboardCode).not.toContain("'billing'");
  });

  it('keeps the fund tab and labels it as coming soon', () => {
    expect(dashboardCode).toContain("value: 'fund'");
    expect(dashboardCode).toContain('הקרן · בקרוב');
  });

  it('keeps every non-billing tab', () => {
    for (const label of ['הצבעות', 'תעודות', 'חדשות', 'הגדרות']) {
      expect(dashboardCode).toContain(label);
    }
  });
});

describe('fund tab renders a coming-soon state only', () => {
  it('does not fetch the personal treasury ledger', () => {
    // The endpoint is deliberately retained server-side; it is simply not
    // called from the dashboard while the fund is closed.
    expect(dashboardCode).not.toContain('/api/user/treasury-contributions');
  });

  it('renders no contribution totals or rows', () => {
    for (const marker of ['fundTotalBox', 'ledgerRows', 'סך תרומתכם לקרן', 'contributions']) {
      expect(dashboardCode).not.toContain(marker);
    }
  });

  it('shows a בקרוב state under the fund tab', () => {
    const fundPanel = dashboardCode.slice(dashboardCode.indexOf("tab === 'fund'"));
    expect(fundPanel.slice(0, 900)).toContain('בקרוב');
  });
});

describe('SYNC tokens and billing are gone from the dashboard', () => {
  it('shows no SYNC or token copy', () => {
    expect(dashboardCode).not.toContain('SYNC');
    expect(dashboardCode).not.toContain('טוקנ');
  });

  it('has no token balance figure or token ledger footer', () => {
    for (const marker of ['tokenBalance', 'tokenLedger', 'tokenFigure', 'syncTokenBalance']) {
      expect(dashboardCode).not.toContain(marker);
    }
  });

  it('has no token-history control', () => {
    expect(dashboardCode).not.toContain('היסטוריית טוקנים');
  });

  it('does not fetch billing or token transactions', () => {
    expect(dashboardCode).not.toContain('/api/user/tokens/transactions');
    expect(dashboardCode).not.toContain('/api/payments/refund');
  });

  it('carries no refund or receipt UI', () => {
    for (const marker of ['refundBox', 'submitRefund', 'Receipt', 'בקשת החזר']) {
      expect(dashboardCode).not.toContain(marker);
    }
  });

  it('shows no zero balance as a replacement', () => {
    // A literal ₪ figure would mean a price or balance crept back in.
    expect(dashboardCode).not.toMatch(/₪\{?\s*\w/);
  });
});

describe("the dashboard's create-vote button carries no price", () => {
  it('reads simply יצירת הצבעה חדשה', () => {
    expect(dashboardCode).toContain('יצירת הצבעה חדשה');
    expect(dashboardCode).not.toContain('CREATE_VOTE_COST');
    expect(dashboardCode).not.toContain('formatCurrency');
  });

  it('still navigates to the create-vote flow, unchanged', () => {
    // Only the label changed; the destination and the flow behind it are
    // outside this slice and untouched.
    expect(dashboardCode).toContain("router.push('/votes/create')");
  });
});

describe('the rest of the dashboard is preserved', () => {
  it('keeps registration statistics', () => {
    expect(dashboardCode).toContain('/api/stats/registrations');
    expect(dashboardCode).toContain('נרשמו לפלטפורמה');
  });

  it('keeps the Community Fund coming-soon card, without the portfolio-value card', () => {
    expect(dashboardCode).toContain('הקרן הקהילתית');
    // "שווי התיקים" was Issue-Coin/BAGS residue — an investment-index framing
    // with no place in the free MVP (removed in Issue #37, Slice 3).
    expect(dashboardCode).not.toContain('שווי התיקים');
    expect(dashboardCode).not.toContain('מדד ההשקעה');
  });

  it('keeps the news coming-soon tab', () => {
    expect(dashboardCode).toContain('חדשות ועדכונים');
    expect(dashboardCode).toContain('עדכונים מהקהילה ומהפעילות המקומית יופיעו כאן בהמשך.');
  });

  it('keeps both location CTAs', () => {
    expect(dashboardCode).toContain('הגדר מיקום');
    expect(dashboardCode).toContain('אמת את המיקום');
    expect(dashboardCode).toContain('/settings/municipality');
    expect(dashboardCode).toContain('/verification');
  });

  it('keeps past votes, certificates and settings', () => {
    expect(dashboardCode).toContain('/api/user/participations');
    expect(dashboardCode).toContain('/api/user/nfts');
    expect(dashboardCode).toContain('/settings/profile');
  });
});
