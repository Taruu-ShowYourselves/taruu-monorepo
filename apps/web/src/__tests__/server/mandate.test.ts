/**
 * What counts as a decision of the residents.
 *
 * This is the arithmetic behind the most quotable thing the product prints -
 * a line addressed to a named authority saying the public decided something.
 * Every case below is a way of printing that line when it is not true: too
 * few people, a dead heat, an open ballot mistaken for a closed one.
 */

import { describe, expect, it } from 'vitest';
import {
  byAuthority,
  decisionOf,
  mandateFrom,
  mandateTotals,
  MANDATE_MIN_BALLOTS,
  type MandateBallot,
} from '@/server/domain/mandate/mandate';

const NATIONAL = 'כנסת ישראל';

const ballot = (over: Partial<MandateBallot> = {}): MandateBallot => ({
  id: 'v-1',
  title: 'שביתת נהגי אוטובוס',
  municipality: 'חיפה',
  status: 'ended',
  endDate: '2026-08-01T00:00:00Z',
  options: [
    { id: 'o-for', text: 'בעד', votes: 9 },
    { id: 'o-against', text: 'נגד', votes: 1 },
  ],
  ...over,
});

describe('decisionOf', () => {
  it('reads a closed ballot as a decision, in the ballot’s own words', () => {
    const decision = decisionOf(ballot(), NATIONAL);
    expect(decision).toMatchObject({
      position: 'בעד',
      share: 90,
      margin: 80,
      ballots: 10,
      standing: 'decided',
      scope: 'municipal',
      municipality: 'חיפה',
    });
  });

  it('reads an open ballot as a standing, never as a decision', () => {
    expect(decisionOf(ballot({ status: 'active' }), NATIONAL)?.standing).toBe('standing');
  });

  it('marks the house’s own items as national', () => {
    expect(decisionOf(ballot({ municipality: NATIONAL }), NATIONAL)?.scope).toBe('national');
  });

  it('refuses a count too small to speak for anyone', () => {
    const thin = ballot({
      options: [
        { id: 'o-for', text: 'בעד', votes: MANDATE_MIN_BALLOTS - 2 },
        { id: 'o-against', text: 'נגד', votes: 1 },
      ],
    });
    expect(decisionOf(thin, NATIONAL)).toBeNull();
  });

  it('refuses a dead heat however many turned out', () => {
    const tied = ballot({
      options: [
        { id: 'o-for', text: 'בעד', votes: 50 },
        { id: 'o-against', text: 'נגד', votes: 50 },
      ],
    });
    expect(decisionOf(tied, NATIONAL)).toBeNull();
  });

  it('refuses a ballot nobody voted in', () => {
    const empty = ballot({
      options: [
        { id: 'o-for', text: 'בעד', votes: 0 },
        { id: 'o-against', text: 'נגד', votes: 0 },
      ],
    });
    expect(decisionOf(empty, NATIONAL)).toBeNull();
  });
});

describe('mandateFrom', () => {
  const decided = ballot({ id: 'closed', status: 'ended' });
  const standing = ballot({
    id: 'open',
    status: 'active',
    options: [
      { id: 'o-for', text: 'בעד', votes: 100 },
      { id: 'o-against', text: 'נגד', votes: 0 },
    ],
  });
  const silent = ballot({
    id: 'silent',
    options: [{ id: 'o-for', text: 'בעד', votes: 0 }],
  });

  it('puts settled decisions ahead of open standings, whatever the majority', () => {
    const mandate = mandateFrom([standing, decided, silent], NATIONAL);
    expect(mandate.map((decision) => decision.voteId)).toEqual(['closed', 'open']);
  });

  it('drops ballots that carry no decision at all', () => {
    expect(mandateFrom([silent], NATIONAL)).toHaveLength(0);
  });

  it('counts the register without double-counting an authority', () => {
    const totals = mandateTotals(mandateFrom([standing, decided], NATIONAL));
    expect(totals).toEqual({
      decided: 1,
      standing: 1,
      ballotsCounted: 110,
      authorities: 1,
    });
  });

  it('groups by the authority a decision is addressed to', () => {
    const other = ballot({ id: 'other', municipality: 'עכו' });
    const grouped = byAuthority(mandateFrom([decided, standing, other], NATIONAL));
    expect(grouped.map((group) => group.municipality)).toEqual(['חיפה', 'עכו']);
    expect(grouped[0].decisions).toHaveLength(2);
  });
});
