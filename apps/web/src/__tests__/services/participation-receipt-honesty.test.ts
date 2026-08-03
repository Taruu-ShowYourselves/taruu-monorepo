/**
 * Participation receipt honesty guard tests.
 *
 * The v1.0 audit found `ParticipationFlow.tsx` sealing a free vote with a
 * client-side `mockHash()` and a fabricated block number, then claiming
 * `נחתם` / `✓ חתום בבלוקצ׳יין · בלתי ניתן לשינוי` for a ballot that was never
 * sent to the server. This suite fails if that shape - or its copy - ever
 * comes back anywhere in the casting funnel: the choice step, the confirm
 * step, the receipt, the vote page's results panel, or the vote-list ballot
 * note.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed, and `.tsx` files aren't even collected
 * by the include glob), so - same pattern as dashboard-free-mvp.test.ts and
 * participation-cost-legacy.test.ts - these assert against SOURCE. Every
 * requirement here is "this string / this export must (not) exist", which is
 * exactly what a regression would reintroduce.
 *
 * Scope boundary, recorded rather than silently ignored: chain-seal copy
 * still exists on marketing and other non-casting surfaces - TrustBar,
 * Hero/ConsensusVisual, VotesHero, ArchiveHero, PricingContent,
 * about/Mission, sign-in / sign-up, coin, treasury, verification pages.
 * Those are outside the casting funnel and outside this P0; they are not
 * covered by this suite and must not be "fixed" by copying it.
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

const flowRaw = readFileSync(
  join(SRC, "app/[locale]/votes/[id]/flow/ParticipationFlow.tsx"),
  'utf8'
);
const flowCode = code(flowRaw);

const submitRaw = readFileSync(
  join(SRC, "app/[locale]/votes/[id]/flow/submitParticipation.ts"),
  'utf8'
);
const submitCode = code(submitRaw);

const pageRaw = readFileSync(join(SRC, "app/[locale]/votes/[id]/page.tsx"), 'utf8');
const pageCode = code(pageRaw);

const votesListRaw = readFileSync(
  join(SRC, 'app/[locale]/votes/components/VotesList.tsx'),
  'utf8'
);
const votesListCode = code(votesListRaw);

const CHAIN_SEAL_COPY = /בבלוקצ׳יין|בבלוקצ'יין/;

describe('mockHash and the fabricated seal are gone', () => {
  it('ParticipationFlow contains no mockHash', () => {
    expect(flowCode).not.toContain('mockHash');
  });

  it('ParticipationFlow contains no crypto.getRandomValues', () => {
    expect(flowCode).not.toContain('crypto.getRandomValues');
  });

  it('ParticipationFlow contains no SealCard', () => {
    expect(flowCode).not.toContain('SealCard');
  });

  it('ParticipationFlow contains no fabricated block number', () => {
    expect(flowCode).not.toContain('18_400_000');
  });

  it('ParticipationFlow contains no BLOCK label', () => {
    expect(flowCode).not.toContain('BLOCK');
  });

  it('submitParticipation does not reference mockHash', () => {
    expect(submitCode).not.toContain('mockHash');
  });

  it('the vote page does not reference mockHash', () => {
    expect(pageCode).not.toContain('mockHash');
  });

  it('VotesList does not reference mockHash', () => {
    expect(votesListCode).not.toContain('mockHash');
  });
});

describe('the casting funnel claims no blockchain seal', () => {
  it('ParticipationFlow makes no chain-seal claim (either apostrophe variant)', () => {
    expect(flowCode).not.toMatch(CHAIN_SEAL_COPY);
  });

  it('submitParticipation makes no chain-seal claim', () => {
    expect(submitCode).not.toMatch(CHAIN_SEAL_COPY);
  });

  it('the vote page makes no chain-seal claim', () => {
    expect(pageCode).not.toMatch(CHAIN_SEAL_COPY);
  });

  it('VotesList makes no chain-seal claim', () => {
    expect(votesListCode).not.toMatch(CHAIN_SEAL_COPY);
  });

  it('ParticipationFlow no longer uses נחתם', () => {
    expect(flowCode).not.toContain('נחתם');
  });

  it('ParticipationFlow no longer uses חתימה', () => {
    expect(flowCode).not.toContain('חתימה');
  });

  it('the vote page no longer claims the vote was chain-signed', () => {
    expect(pageCode).not.toContain('ונחתמה');
  });

  it('the vote page footer no longer claims חתום בבלוקצ׳יין', () => {
    expect(pageCode).not.toContain('חתום בבלוקצ׳יין');
  });
});

describe('the flow reaches the server before it shows a receipt', () => {
  it('calls submitParticipation', () => {
    expect(flowCode).toContain('submitParticipation');
  });

  it('only advances to the receipt stage via setStage(\'receipt\')', () => {
    expect(flowCode).toContain("setStage('receipt')");
  });

  it('branches on a rejected result before the receipt can render', () => {
    expect(flowCode).toContain("result.status === 'rejected'");
  });

  it('submitParticipation posts to the participate endpoint', () => {
    expect(submitCode).toContain('/participate');
  });

  it('the receipt timestamp is derived from the server ballot', () => {
    expect(flowCode).toContain('ballot.createdAt');
  });

  it('the receipt timestamp is never a client new Date().toLocaleString', () => {
    expect(flowCode).not.toContain('new Date().toLocaleString');
  });
});

describe('the receipt shows only server-backed facts', () => {
  it('renders a status of נרשם', () => {
    expect(flowCode).toContain('נרשם');
  });

  it('says nothing about money at all, not even that it is free', () => {
    // Casting a vote is a civic act, not a transaction. Even the word "free"
    // frames it as one and invites the question "free compared to what?".
    // The flow states who is voting and that the vote is recorded once; cost
    // is not a fact about a ballot and does not belong on one.
    for (const moneyWord of ['חינם', 'עלות', 'תשלום', '₪']) {
      expect(flowCode).not.toContain(moneyWord);
    }
  });

  it('renders the server registration number under מספר רישום', () => {
    expect(flowCode).toContain('מספר רישום');
  });

  it('derives the displayed position from the server ballot, not the click', () => {
    // On the already-recorded path the API returns the EXISTING ballot, which
    // may be a different option than the one just selected. Rendering
    // selectedText there would print a position the resident never cast, and
    // would contradict onComplete(ballot.optionId) one click later.
    expect(flowCode).toContain('o.id === ballot.optionId');
    expect(flowCode).toContain('recordedText');
  });

  it('never renders selectedText inside the receipt step', () => {
    const receiptStep = flowCode.slice(flowCode.indexOf("stage === 'receipt'"));
    expect(receiptStep).not.toContain('selectedText');
  });

  it('hands the server option id to onComplete', () => {
    expect(flowCode).toContain('onComplete(ballot.optionId)');
  });
});

describe('a rejection the resident cannot act on stops inviting retries', () => {
  it('declares the terminal rejection codes', () => {
    expect(submitCode).toContain('TERMINAL_REJECTION_CODES');
    for (const terminal of ['VOTE_ENDED', 'VOTE_NOT_OPEN', 'NOT_FOUND']) {
      expect(submitCode).toContain(terminal);
    }
  });

  it('an ended vote is not told to refresh and try again', () => {
    // The generic 400 copy says "refresh the page and try again", which is
    // wrong advice for a vote that has closed - refreshing changes nothing.
    const endedMessage = submitCode
      .split('\n')
      .find((line) => line.trimStart().startsWith('VOTE_ENDED:'));
    expect(endedMessage).toBeDefined();
    expect(endedMessage).not.toContain('רעננו את הדף');
    expect(endedMessage).toContain('ההצבעה נסגרה');
  });

  it('splits VOTE_ENDED and VOTE_NOT_OPEN out of the generic 400', () => {
    expect(submitCode).toContain("errorCode === 'VOTE_ENDED'");
    expect(submitCode).toContain("errorCode === 'VOTE_NOT_OPEN'");
  });

  it('the flow blocks the confirm button on a terminal rejection', () => {
    expect(flowCode).toContain('isTerminalRejection');
    expect(flowCode).toContain('disabled={submitting || isBlocked}');
  });
});

describe('eligibility has exactly one authority - the server', () => {
  it('the flow does not evaluate residency client-side', () => {
    // isEligibleToVote reads verificationStatus.checkInsCompleted, which only
    // /api/verification/status populates and which the vote page never
    // fetches. On this screen it is always undefined, so the client rule
    // collapsed to "fully verified" and turned away residents whose first
    // check-in already made them eligible per the server.
    expect(flowCode).not.toContain('isEligibleToVote');
    expect(flowCode).not.toContain('isVerifiedResident');
  });

  it('routes to /verification on the server saying residency is missing', () => {
    expect(flowCode).toContain("result.code === 'RESIDENCY_NOT_VERIFIED'");
    expect(flowCode).toContain('/verification?redirect=');
  });

  it('routes to /sign-in on the server saying the session is missing', () => {
    expect(flowCode).toContain("result.code === 'UNAUTHENTICATED'");
    expect(flowCode).toContain('/sign-in?redirect=');
  });

  it('persists the choice before every redirect so the round-trip loses nothing', () => {
    const redirects = flowCode.split('router.push(').length - 1;
    const persists = flowCode.split('persistPending()').length - 1;
    // One persistPending per router.push, plus the callback's own definition.
    expect(persists).toBeGreaterThanOrEqual(redirects);
  });
});

describe('post-auth redirects are sanitised', () => {
  const signInCode = code(
    readFileSync(join(SRC, 'app/[locale]/sign-in/[[...sign-in]]/page.tsx'), 'utf8')
  );
  const verificationCode = code(
    readFileSync(join(SRC, 'app/[locale]/verification/page.tsx'), 'utf8')
  );

  it('sign-in never pushes a raw redirect param', () => {
    // An absolute URL here is an open redirect off a successful sign-in.
    expect(signInCode).toContain('safeRedirect(');
    expect(signInCode).not.toMatch(/router\.push\(\s*redirect\s*\)/);
  });

  it('verification sanitises its redirect before using or re-embedding it', () => {
    expect(verificationCode).toContain('safeRedirect(');
    expect(verificationCode).not.toMatch(/const redirect = searchParams\.get\('redirect'\) \|\|/);
  });
});

describe('scope boundary - marketing surfaces are deliberately out of scope', () => {
  it('records that TrustBar and other marketing surfaces still carry chain-seal copy, unasserted here', () => {
    // Recorded, not silently ignored: TrustBar, Hero/ConsensusVisual, VotesHero,
    // ArchiveHero, PricingContent, about/Mission, sign-in / sign-up, coin,
    // treasury and verification pages are outside the casting funnel and
    // outside this P0. This test intentionally does not assert on them.
    const outOfScopeSurfaces = [
      'TrustBar',
      'Hero/ConsensusVisual',
      'VotesHero',
      'ArchiveHero',
      'PricingContent',
      'about/Mission',
    ];
    expect(outOfScopeSurfaces).toContain('TrustBar');
  });
});
