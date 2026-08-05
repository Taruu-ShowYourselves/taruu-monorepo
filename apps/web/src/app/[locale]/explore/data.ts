/**
 * /explore server data layer.
 *
 * One page, one votes query: S3 (now deciding), S4 (municipality index) and
 * S5 (Knesset strip) all derive from the single `getActiveVotesWithOptions()`
 * payload assembled here. The only extra queries are the money aggregates
 * (treasury sum + weekly growth) and the national registration count - both
 * degrade to `null` so the page can print an honest empty edition when the
 * DB is unreachable (build-time prerender in CI, issue #39 pattern).
 */

import { KNESSET_SCOPE, MUNICIPALITIES } from '@sync/shared';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { DeskTopic } from '@/components/press/sections/DeskTopicRow';
import {
  toDeskTopic,
  type VoteWithRelations,
} from '@/components/press/sections/deskData';

/** A live topic paired with the desk (municipality) it runs on. */
export interface NowTopic {
  municipality: string;
  topic: DeskTopic;
}

/** One row of the municipality directory (S4). */
export interface MuniRow {
  name: string;
  openVotes: number;
  ballots: number;
}

export interface ExploreEdition {
  /** Hottest municipal topics across all desks, hotness-descending. */
  nowDeciding: NowTopic[];
  /** Full static municipality list with per-muni aggregates. */
  muniRows: MuniRow[];
  /** Top Knesset agenda topics, hotness-descending. */
  knessetTop: NowTopic[];
  /** All active votes network-wide (municipal + national). */
  activeVotes: number;
  /** Distinct municipalities with at least one live vote. */
  municipalitiesLive: number;
  /** False when the votes payload came back empty (no data / DB down). */
  hasVotes: boolean;
}

const byHotness = (a: NowTopic, b: NowTopic) =>
  (b.topic.source?.hotness ?? 0) - (a.topic.source?.hotness ?? 0) ||
  b.topic.participantCount - a.topic.participantCount;

const ballotsOf = (topic: DeskTopic) =>
  topic.options.reduce((sum, o) => sum + o.votes, 0);

/** Split + derive every votes-driven surface from the single payload. */
export function buildExploreEdition(votes: VoteWithRelations[]): ExploreEdition {
  const municipal: NowTopic[] = [];
  const knesset: NowTopic[] = [];

  for (const vote of votes) {
    const entry = { municipality: vote.municipality_id, topic: toDeskTopic(vote) };
    if (vote.municipality_id === KNESSET_SCOPE) {
      knesset.push(entry);
    } else {
      municipal.push(entry);
    }
  }

  municipal.sort(byHotness);
  knesset.sort(byHotness);

  const perMuni = new Map<string, { openVotes: number; ballots: number }>();
  for (const { municipality, topic } of municipal) {
    const bucket = perMuni.get(municipality) ?? { openVotes: 0, ballots: 0 };
    bucket.openVotes += 1;
    bucket.ballots += ballotsOf(topic);
    perMuni.set(municipality, bucket);
  }

  const muniRows: MuniRow[] = MUNICIPALITIES.map((name) => ({
    name,
    openVotes: perMuni.get(name)?.openVotes ?? 0,
    ballots: perMuni.get(name)?.ballots ?? 0,
  }));

  return {
    nowDeciding: municipal.slice(0, 8),
    muniRows,
    knessetTop: knesset.slice(0, 3),
    activeVotes: votes.length,
    municipalitiesLive: perMuni.size,
    hasVotes: votes.length > 0,
  };
}

export interface MoneyStats {
  /** Total ILS accrued across all municipal treasuries. */
  totalRaisedIls: number;
  /** Week-over-week voter growth, -1..n (0 = flat). */
  weeklyGrowth: number;
}

/**
 * Money aggregates for the pulse strip + money desk. Same figures as
 * `GET /api/stats/network`, trimmed to what /explore prints, fetched
 * server-side inside the page's ISR window. Throws on failure - callers
 * `.catch(() => null)` so a missing figure prints `-`, never a fake 0.
 */
export async function getMoneyStats(): Promise<MoneyStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [treasuryRes, weekRes, prevWeekRes] = await Promise.all([
    supabaseAdmin.from('treasury').select('total_collected_ils'),
    supabaseAdmin
      .from('user_votes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),
    supabaseAdmin
      .from('user_votes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo)
      .lt('created_at', weekAgo),
  ]);

  if (treasuryRes.error) throw treasuryRes.error;

  const totalAgorot = (treasuryRes.data ?? []).reduce(
    (sum: number, t: { total_collected_ils: number | null }) =>
      sum + (t.total_collected_ils || 0),
    0
  );

  const week = weekRes.count ?? 0;
  const prevWeek = prevWeekRes.count ?? 0;
  const weeklyGrowth =
    prevWeek > 0 ? (week - prevWeek) / prevWeek : week > 0 ? 1 : 0;

  return {
    totalRaisedIls: totalAgorot / 100,
    weeklyGrowth: Math.round(weeklyGrowth * 100) / 100,
  };
}
