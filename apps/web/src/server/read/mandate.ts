import 'server-only';
import { cache } from 'react';
import { KNESSET_SCOPE } from '@sync/shared';
import { getDecidedVotesWithOptions } from '@/lib/supabase/db';
import { activeVotesWithOptions } from './active-votes';
import {
  mandateFrom,
  mandateTotals,
  type MandateDecision,
  type MandateTotals,
} from '@/server/domain/mandate/mandate';

export interface CivicMandateRead {
  /** Knesset and government items. */
  national: MandateDecision[];
  /** Everything addressed to a local or regional authority. */
  municipal: MandateDecision[];
  totals: MandateTotals;
}

/**
 * The whole civic mandate, memoised for the life of one request.
 *
 * Closed ballots and open ones are read together and told apart by their
 * standing rather than by which query they came from - the mandate page shows
 * both, and the homepage's closing beat shows whichever exist. Both reads
 * degrade to empty, so a young ledger prints an empty mandate instead of an
 * error, and so does a build-time prerender with no service-role key.
 */
export const civicMandate = cache(async (): Promise<CivicMandateRead> => {
  const [decided, active] = await Promise.all([
    getDecidedVotesWithOptions().catch(() => []),
    activeVotesWithOptions(),
  ]);

  const decisions = mandateFrom(
    [...decided, ...active].map((vote) => ({
      id: vote.id,
      title: vote.title,
      municipality: vote.municipality_id,
      status: vote.status,
      endDate: vote.end_date,
      options: vote.options.map((option) => ({
        id: option.id,
        text: option.text,
        votes: option.votes ?? 0,
      })),
    })),
    KNESSET_SCOPE
  );

  return {
    national: decisions.filter((decision) => decision.scope === 'national'),
    municipal: decisions.filter((decision) => decision.scope === 'municipal'),
    totals: mandateTotals(decisions),
  };
});
