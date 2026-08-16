/**
 * ₪3 participation-legacy guard tests.
 *
 * Participation became free in cfa5d25 (2026-07-29). `VOTE_COST` was retired
 * from @sync/shared in favour of an explicit `VOTE_PARTICIPATION_COST = 0`,
 * the mobile vote screen's cost copy was rewritten to say so, and the legacy
 * Green Invoice `vote_participation` rail had its ₪3 amount pinned to a local
 * literal pending a decision. Phase 3 (plan 03-02) made that decision and
 * deleted the rail. This suite fails if any of those surfaces regress.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed), so - same pattern as
 * dashboard-free-mvp.test.ts - these assert against SOURCE. Every requirement
 * here is "this string / this export must (not) exist", which is exactly
 * what a regression would reintroduce.
 *
 * Resolved 2026-08-03 (was recorded here as deliberately deferred):
 * `apps/mobile/app/vote/[id].tsx`'s `handleVote` no longer pushes to
 * `/payment/checkout`. It calls `votesApi.participate({ voteId, optionId })`,
 * the same endpoint the web flow records through, so both surfaces share one
 * contract and one server-side eligibility rule. The assertions below hold
 * that line. Note this is still source-level proof only. The mobile app has
 * not been exercised end to end against a running API.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// process.cwd() is apps/web when this suite runs; walk up to the repo root
// to reach packages/shared and apps/mobile.
const REPO = join(process.cwd(), '..', '..');

/** Strip // and block comments so prose about the change is not read as code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// Matches a bare VOTE_COST token that is not part of CREATE_VOTE_COST.
const BARE_VOTE_COST = /(?<!CREATE_)VOTE_COST/;

const sharedConstantsRaw = readFileSync(
  join(REPO, 'packages/shared/src/constants/index.ts'),
  'utf8'
);
const sharedConstantsCode = code(sharedConstantsRaw);

const paymentTypesRaw = readFileSync(
  join(REPO, 'packages/shared/src/types/payment.ts'),
  'utf8'
);

const mobileVoteScreenRaw = readFileSync(
  join(REPO, "apps/mobile/app/vote/[id].tsx"),
  'utf8'
);
const mobileVoteScreenCode = code(mobileVoteScreenRaw);

const greenInvoiceRaw = readFileSync(
  join(REPO, 'apps/web/src/services/payments/greenInvoice.ts'),
  'utf8'
);
const greenInvoiceCode = code(greenInvoiceRaw);

describe('shared constants', () => {
  it('exports an explicit free-participation constant', () => {
    expect(sharedConstantsCode).toContain('export const VOTE_PARTICIPATION_COST = 0');
  });

  it('no longer exports or references a bare VOTE_COST', () => {
    expect(sharedConstantsCode).not.toMatch(BARE_VOTE_COST);
  });

  it('leaves CREATE_VOTE_COST untouched - vote creation is still paid', () => {
    expect(sharedConstantsCode).toContain('export const CREATE_VOTE_COST = 50');
  });

  it('has no dangling VOTE_COST reference in the payment types comment', () => {
    // The target here IS a comment, so this is read raw rather than through code().
    expect(paymentTypesRaw).not.toMatch(BARE_VOTE_COST);
  });
});

describe('mobile vote screen', () => {
  it('no longer imports or references VOTE_COST', () => {
    expect(mobileVoteScreenCode).not.toContain('VOTE_COST');
  });

  it('no longer quotes a ₪ participation cost', () => {
    expect(mobileVoteScreenCode).not.toContain('עלות הצבעה');
  });

  it('no longer claims a blockchain recording', () => {
    expect(mobileVoteScreenCode).not.toMatch(/בבלוקצ'יין|בבלוקצ׳יין/);
  });

  it('says nothing about money at all, not even that it is free', () => {
    // Same rule as the web flow: a resident casting a vote should never be
    // prompted to think about money, and "free" is still a claim about price.
    for (const moneyWord of ['חינם', 'עלות', 'תשלום', '₪']) {
      expect(mobileVoteScreenCode).not.toContain(moneyWord);
    }
  });

  it('records the ballot instead of routing to a payment checkout', () => {
    // handleVote used to push to /payment/checkout - a leftover from the ₪3
    // era. A checkout screen for a free vote is both a dead end and a false
    // claim about what voting costs.
    expect(mobileVoteScreenCode).not.toContain('/payment/checkout');
    expect(mobileVoteScreenCode).toContain('votesApi.participate(');
  });

  it('reflects the ballot the server recorded, not the one tapped', () => {
    // Same defect the web receipt had: on the already-recorded path the API
    // returns the EXISTING ballot, which may be a different option.
    expect(mobileVoteScreenCode).toContain('result.participation.optionId');
    expect(mobileVoteScreenCode).toContain('alreadyRecorded');
  });

  it('never surfaces a raw server error string', () => {
    expect(mobileVoteScreenCode).not.toMatch(/Alert\.alert\([^)]*\berr\b/);
  });
});

describe('green invoice legacy rail', () => {
  it('no longer imports VOTE_COST from @sync/shared', () => {
    const sharedImportLines = greenInvoiceCode
      .split('\n')
      .filter((line) => line.includes("from '@sync/shared'"));
    expect(sharedImportLines.length).toBeGreaterThan(0);

    const valueImportLine = sharedImportLines.find((line) => !line.includes('import type'));
    expect(valueImportLine).toBeDefined();
    expect(valueImportLine).toContain('CREATE_VOTE_COST');

    for (const line of sharedImportLines) {
      expect(line).not.toMatch(BARE_VOTE_COST);
    }
  });

  it('no longer carries a participation amount at all', () => {
    // Retired by Phase 3 (plan 03-02), which this suite previously deferred to.
    // The rail is gone rather than repriced: a ₪0 participation payment would
    // still be a payment, and there is no such thing any more.
    expect(greenInvoiceCode).not.toContain('VOTE_PARTICIPATION_AMOUNT');
    expect(greenInvoiceCode).not.toContain('createVotePayment');
  });
});
