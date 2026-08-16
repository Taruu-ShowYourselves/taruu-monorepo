/**
 * The civic mandate: what the residents have actually decided.
 *
 * A ballot is a question while it is open and an instruction once it closes.
 * This module is the second half of that sentence - given the ballots and
 * their tallies, it says which of them carry a decision, what that decision
 * is, and how much of the public stands behind it.
 *
 * Boundary-free on purpose (no Supabase, no React, no clocks passed in
 * implicitly): the mandate is the most quotable thing this product produces -
 * it is what a municipality is shown and, eventually, what a court is shown -
 * so the arithmetic behind it has to be readable on its own and testable
 * without a database.
 */

/** The scale a decision was taken on. */
export type MandateScope = 'national' | 'municipal';

/**
 * How settled a decision is.
 *
 * `decided` - the ballot is closed; this is the public's answer, full stop.
 * `standing` - the ballot is still open and this is where it stands. Printed
 * as a standing, never as a decision: an open count can still turn.
 */
export type MandateStanding = 'decided' | 'standing';

export interface MandateBallotOption {
  id: string;
  text: string;
  votes: number;
}

export interface MandateBallot {
  id: string;
  title: string;
  municipality: string;
  status: string;
  endDate: string;
  options: MandateBallotOption[];
}

export interface MandateDecision {
  voteId: string;
  title: string;
  scope: MandateScope;
  /** The authority the decision is addressed to. */
  municipality: string;
  /** The position that carried it, in the ballot's own words. */
  position: string;
  /** Share of the ballots cast, 0-100, rounded. */
  share: number;
  /** How far ahead of the runner-up, in points. */
  margin: number;
  ballots: number;
  standing: MandateStanding;
  /** When the ballot closes, or closed. */
  endDate: string;
}

/**
 * A decision needs a real count behind it.
 *
 * One ballot is a person, not a mandate, and a tie is the public declining to
 * instruct anyone. Both are excluded rather than printed faintly: a mandate
 * page that lists a 1-0 result has taught its reader to discount the rest of
 * the list.
 */
export const MANDATE_MIN_BALLOTS = 5;

const CLOSED_STATUSES = new Set(['ended', 'resolving', 'resolved']);

/**
 * Read one ballot as a decision, or as nothing at all.
 *
 * Returns null when the ballot has no options, too few ballots to speak for
 * anyone, or no single leading position. Never guesses a winner from a tie.
 */
export function decisionOf(
  ballot: MandateBallot,
  nationalScope: string
): MandateDecision | null {
  const total = ballot.options.reduce((sum, option) => sum + option.votes, 0);
  if (total < MANDATE_MIN_BALLOTS) return null;

  const ranked = [...ballot.options].sort((a, b) => b.votes - a.votes);
  const [leader, runnerUp] = ranked;
  if (!leader || leader.votes === 0) return null;
  // A dead heat is not a decision, however many people turned out for it.
  if (runnerUp && runnerUp.votes === leader.votes) return null;

  const share = Math.round((leader.votes / total) * 100);
  const margin = share - Math.round(((runnerUp?.votes ?? 0) / total) * 100);

  return {
    voteId: ballot.id,
    title: ballot.title,
    scope: ballot.municipality === nationalScope ? 'national' : 'municipal',
    municipality: ballot.municipality,
    position: leader.text,
    share,
    margin,
    ballots: total,
    standing: CLOSED_STATUSES.has(ballot.status) ? 'decided' : 'standing',
    endDate: ballot.endDate,
  };
}

/**
 * Every ballot that carries a decision, the settled ones first.
 *
 * Within each group the widest majority leads: the mandate is an argument
 * about legitimacy, and the item 91% of a town agreed on is the one that
 * argument opens with.
 */
export function mandateFrom(
  ballots: MandateBallot[],
  nationalScope: string
): MandateDecision[] {
  return ballots
    .map((ballot) => decisionOf(ballot, nationalScope))
    .filter((decision): decision is MandateDecision => decision !== null)
    .sort((a, b) => {
      if (a.standing !== b.standing) return a.standing === 'decided' ? -1 : 1;
      return b.share - a.share || b.ballots - a.ballots;
    });
}

export interface MandateTotals {
  /** Ballots that closed with a decision on them. */
  decided: number;
  /** Open ballots currently carrying a standing. */
  standing: number;
  /** Every ballot counted into the two figures above. */
  ballotsCounted: number;
  /** Authorities addressed by at least one decision. */
  authorities: number;
}

export function mandateTotals(decisions: MandateDecision[]): MandateTotals {
  return {
    decided: decisions.filter((decision) => decision.standing === 'decided').length,
    standing: decisions.filter((decision) => decision.standing === 'standing').length,
    ballotsCounted: decisions.reduce((sum, decision) => sum + decision.ballots, 0),
    authorities: new Set(decisions.map((decision) => decision.municipality)).size,
  };
}

/** The decisions addressed to one authority, in the order the mandate prints. */
export function byAuthority(
  decisions: MandateDecision[]
): { municipality: string; decisions: MandateDecision[] }[] {
  const grouped = new Map<string, MandateDecision[]>();
  for (const decision of decisions) {
    const list = grouped.get(decision.municipality);
    if (list) list.push(decision);
    else grouped.set(decision.municipality, [decision]);
  }
  return [...grouped.entries()]
    .map(([municipality, list]) => ({ municipality, decisions: list }))
    .sort((a, b) => b.decisions.length - a.decisions.length);
}
