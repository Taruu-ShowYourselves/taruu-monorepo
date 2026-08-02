/**
 * ₪3 participation-legacy guard tests.
 *
 * Participation became free in cfa5d25 (2026-07-29). `VOTE_COST` was retired
 * from @sync/shared in favour of an explicit `VOTE_PARTICIPATION_COST = 0`,
 * the mobile vote screen's cost copy was rewritten to say so, and the legacy
 * Green Invoice `vote_participation` rail had its ₪3 amount pinned to a local
 * literal (deliberately unchanged behaviour) instead of importing the retired
 * constant. This suite fails if any of those three surfaces regress.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed), so — same pattern as
 * dashboard-free-mvp.test.ts — these assert against SOURCE. Every requirement
 * here is "this string / this export must (not) exist", which is exactly
 * what a regression would reintroduce.
 *
 * Known, deliberately-deferred follow-up (NOT covered by this suite):
 * `apps/mobile/app/vote/[id].tsx`'s `handleVote` still pushes to
 * `/payment/checkout` for a vote that this file now advertises as free.
 * Rewiring mobile to call `votesApi.participate({ voteId, optionId })`
 * requires the mobile app to be exercised end to end and is outside this
 * phase's blast radius (see 02.1-03-PLAN.md success criteria). A future
 * reader should not mistake the untouched `handleVote` for an oversight.
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

  it('leaves CREATE_VOTE_COST untouched — vote creation is still paid', () => {
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

  it('states that participation is free', () => {
    expect(mobileVoteScreenCode).toContain('ההשתתפות חינם');
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

  it('keeps the legacy ₪3 amount pinned locally and unchanged', () => {
    // Deliberately unchanged behaviour: this rail is unused by any web UI but
    // is still wired through /api/payments/create, so its amount must not
    // silently become 0. Retiring it belongs to the Phase 3 payment re-scope.
    expect(greenInvoiceCode).toContain('const VOTE_PARTICIPATION_AMOUNT = 3;');
  });
});
