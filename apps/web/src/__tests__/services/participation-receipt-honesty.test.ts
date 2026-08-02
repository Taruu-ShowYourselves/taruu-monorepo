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

  it('renders a cost of חינם', () => {
    expect(flowCode).toContain('חינם');
  });

  it('renders the server registration number under מספר רישום', () => {
    expect(flowCode).toContain('מספר רישום');
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
