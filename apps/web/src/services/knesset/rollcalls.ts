/**
 * Knesset roll-call sync - mirrors the chamber's own recorded votes, and how
 * each member voted in them, from the plenum feed (OData v4).
 *
 * This is the half of the platform that makes representation measurable.
 * `knesset_items.item_id` (the plenum item a Taruu national ballot was opened
 * on) and `KNS_PlenumVoteResult.ItemID` are the same number, so once a vote is
 * mirrored the public's tally and the chamber's tally sit on one row - see
 * the `knesset_matched_votes` view.
 *
 * Totals are computed here from the individual stances rather than read off a
 * header, because the plenum feed does not publish them. That is the stricter
 * reading anyway: the number this page prints is the sum of named people's
 * recorded votes, not a figure taken on trust.
 *
 * Runs from /api/cron/knesset-rollcalls. Idempotent: the upstream vote id is
 * the identity and stances are keyed by (roll call, member).
 */

import { cronLogger as log } from '@/lib/logger';
import {
  personIdsByName,
  publishedItemIds,
  rollCallIdsWithStances,
  upsertRollCalls,
  upsertStances,
  normalizeName,
  type RollCallInsert,
  type StanceInsert,
} from '@/server/infra/supabase/government.repo';
import {
  fetchPlenumVoteResults,
  fetchRecentPlenumVotes,
  parseStance,
  type KnsPlenumVote,
} from './odata';

const SOURCE_NAME = 'הכנסת · מליאה (OData v4)';
const SOURCE_URL = 'https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVote';

/**
 * Stance fetches per run. One request per vote is the only shape the upstream
 * filter supports, so the job is deliberately incremental: it takes a bounded
 * bite each run and converges over a few hours rather than holding a cron open
 * for hundreds of round-trips.
 */
const STANCE_FETCH_BUDGET = 40;

/** How far back the mirror reaches; the participation denominator with it. */
const RECENT_VOTE_WINDOW = 300;

export interface RollCallSyncResult {
  knessetNum: number;
  rollCallsSeen: number;
  rollCallsUpserted: number;
  stanceFetches: number;
  stancesUpserted: number;
  stancesUnresolved: number;
  errors: string[];
}

/**
 * Which votes to spend this run's stance budget on.
 *
 * Items Taruu actually published lead, because those are the only ones that
 * can produce a representation figure; the rest follow newest-first and feed
 * the participation denominator. Anything already mirrored is skipped, so a
 * steady state costs nothing.
 */
export function prioritizeRollCalls(
  rows: KnsPlenumVote[],
  publishedItems: Set<number>,
  alreadyMirrored: Set<number>,
  budget: number
): KnsPlenumVote[] {
  const pending = rows.filter((row) => !alreadyMirrored.has(row.Id));
  const matched: KnsPlenumVote[] = [];
  const rest: KnsPlenumVote[] = [];

  for (const row of pending) {
    if (row.ItemID !== null && publishedItems.has(row.ItemID)) matched.push(row);
    else rest.push(row);
  }

  return [...matched, ...rest].slice(0, Math.max(0, budget));
}

export async function syncKnessetRollCalls(
  knessetNum: number,
  now: Date = new Date()
): Promise<RollCallSyncResult> {
  const asOf = now.toISOString().slice(0, 10);
  const errors: string[] = [];

  const headers = await fetchRecentPlenumVotes(RECENT_VOTE_WINDOW);

  const [publishedItems, mirrored, personByName] = await Promise.all([
    publishedItemIds().catch(() => new Set<number>()),
    rollCallIdsWithStances(headers.map((row) => row.Id)).catch(
      () => new Set<number>()
    ),
    personIdsByName().catch(() => new Map<string, number>()),
  ]);

  const todo = prioritizeRollCalls(
    headers,
    publishedItems,
    mirrored,
    STANCE_FETCH_BUDGET
  );

  let rollCallsUpserted = 0;
  let stancesUpserted = 0;
  let unresolved = 0;

  for (const header of todo) {
    try {
      const results = await fetchPlenumVoteResults(header.Id);
      if (results.length === 0) continue;

      const stances: StanceInsert[] = results.map((result) => {
        /* The plenum feed numbers members in its own id space - MkId is not
           the roster's PersonID - but it ships the name in two fields, which
           is exactly what the roster stores. A name that does not resolve
           keeps its row with a null person: the chamber's tally stays
           complete, and that member contributes to nobody's score rather than
           being attached to whoever looks closest. */
        const fullName = `${result.FirstName ?? ''} ${result.LastName ?? ''}`.trim();
        const personId = personByName.get(normalizeName(fullName)) ?? null;
        if (personId === null) unresolved += 1;

        return {
          roll_call_id: header.Id,
          member_key: String(result.MkId),
          person_id: personId,
          member_name: fullName || String(result.MkId),
          faction_name: null,
          stance: parseStance(result.ResultCode),
        };
      });

      const totals = stances.reduce(
        (acc, row) => {
          if (row.stance === 'for') acc.for += 1;
          else if (row.stance === 'against') acc.against += 1;
          else if (row.stance === 'abstain') acc.abstain += 1;
          return acc;
        },
        { for: 0, against: 0, abstain: 0 }
      );

      const row: RollCallInsert = {
        roll_call_id: header.Id,
        knesset_num: knessetNum,
        session_id: header.SessionID,
        sess_item_id: header.ItemID,
        item_description: header.VoteTitle?.trim() ?? null,
        vote_subject: header.VoteSubject?.trim() ?? null,
        vote_date: header.VoteDateTime,
        total_for: totals.for,
        total_against: totals.against,
        total_abstain: totals.abstain,
        /* The feed publishes no accepted flag, so this is the plain reading of
           a majority vote rather than a claim from upstream. Nothing on the
           pages leans on it - the sides are compared through the tallies. */
        is_accepted: totals.for > totals.against,
        source_name: SOURCE_NAME,
        source_url: SOURCE_URL,
        as_of: asOf,
        fetched_at: now.toISOString(),
      };

      /* Header first: the stance rows reference it, and a vote whose results
         failed to load must not leave an empty tally behind claiming 0-0. */
      rollCallsUpserted += await upsertRollCalls([row]);
      stancesUpserted += await upsertStances(stances);
    } catch (error: unknown) {
      errors.push(
        `vote ${header.Id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (errors.length > 0) {
    log.warn('roll-call sync finished with errors', { count: errors.length });
  }

  return {
    knessetNum,
    rollCallsSeen: headers.length,
    rollCallsUpserted,
    stanceFetches: todo.length,
    stancesUpserted,
    stancesUnresolved: unresolved,
    errors,
  };
}
