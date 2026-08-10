import 'server-only';
import { cache } from 'react';
import {
  GOV_OFFICE_ORDER,
  GovPositionSchema,
  type GovOffice,
  type GovPosition,
  type GovernmentCivicStats,
  type GovReview,
  type GovStance,
  type KnessetMember,
  type MatchedVote,
} from '@sync/shared/contracts';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * The government read models.
 *
 * Every one of them degrades to empty rather than throwing, like the desk
 * reads on the front page: a build-time prerender with no service-role key
 * (#39) must print a government page with an unpublished roster, not fail the
 * route. All are memoised per request - the roster page prints the house's
 * stats and all 120 members from one render.
 */

const asScore = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

/** The highest office a member holds, for their one-line description. */
export function topOfficeOf(positions: GovPosition[]): GovOffice {
  for (const office of GOV_OFFICE_ORDER) {
    if (positions.some((position) => position.office === office)) return office;
  }
  return 'mk';
}

/**
 * The positions column arrives as JSON built in SQL. It is validated rather
 * than cast: the aggregate is assembled by hand in the RPC, and a silent
 * shape drift there would otherwise surface as a blank office line on a real
 * person's page.
 */
function parsePositions(raw: unknown): GovPosition[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = GovPositionSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export const knessetRoster = cache(async (): Promise<KnessetMember[]> => {
  const { data, error } = await supabaseAdmin.rpc('knesset_roster_public');
  if (error || !data) return [];

  return data.map((row): KnessetMember => {
    const positions = parsePositions(row.positions);
    return {
      personId: Number(row.person_id),
      slug: row.slug,
      fullName: row.full_name,
      firstName: row.first_name,
      lastName: row.last_name,
      factionName: row.faction_name,
      positions,
      topOffice: topOfficeOf(positions),
      knessetNum: row.knesset_num,
      source: {
        name: row.source_name,
        url: row.source_url,
        asOf: row.as_of,
      },
      scores: {
        alignmentScore: asScore(row.alignment_score),
        participationScore: asScore(row.participation_score),
        trustScore: asScore(row.trust_score),
        overallScore: asScore(row.overall_score),
        matchedVotes: Number(row.matched_votes ?? 0),
        rollCalls: Number(row.roll_calls ?? 0),
        recordedVotes: Number(row.recorded_votes ?? 0),
        reviewCount: Number(row.review_count ?? 0),
        ratingAverage:
          row.rating_average === null || row.rating_average === undefined
            ? null
            : Number(row.rating_average),
      },
    };
  });
});

export const governmentStats = cache(
  async (): Promise<GovernmentCivicStats | null> => {
    const { data, error } = await supabaseAdmin.rpc('government_civic_stats');
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return null;

    return {
      knessetNum: row.knesset_num,
      members: Number(row.members ?? 0),
      factions: Number(row.factions ?? 0),
      openTopics: Number(row.open_topics ?? 0),
      decidedTopics: Number(row.decided_topics ?? 0),
      ballotsCounted: Number(row.ballots_counted ?? 0),
      platformUsers: Number(row.platform_users ?? 0),
      activeParticipants: Number(row.active_participants ?? 0),
      matchedItems: Number(row.matched_items ?? 0),
      agreedItems: Number(row.agreed_items ?? 0),
      representationScore: asScore(row.representation_score),
      engagementScore: asScore(row.engagement_score),
      cooperationScore: asScore(row.cooperation_score),
      trustScore: asScore(row.trust_score),
      overallScore: asScore(row.overall_score),
    };
  }
);

/** The term the roster is currently on; null before the first roster sync. */
export const currentKnessetNum = cache(async (): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from('knesset_persons')
    .select('knesset_num')
    .eq('is_current', true)
    .not('knesset_num', 'is', null)
    .order('knesset_num', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.knesset_num;
});

const SIDES = new Set(['for', 'against']);
const asSide = (value: string | null): 'for' | 'against' | null =>
  value !== null && SIDES.has(value) ? (value as 'for' | 'against') : null;

const STANCES = new Set<GovStance>(['for', 'against', 'abstain', 'absent']);
const asStance = (value: string | null): GovStance | null =>
  value !== null && STANCES.has(value as GovStance) ? (value as GovStance) : null;

/**
 * The matched items behind one member's alignment score.
 *
 * A score is a claim about a person; this is the evidence for it, and the
 * member page prints them together on purpose.
 */
export const memberMatchedVotes = cache(
  async (personId: number): Promise<MatchedVote[]> => {
    const { data, error } = await supabaseAdmin.rpc(
      'knesset_member_votes_public',
      { p_person_id: personId }
    );
    if (error || !data) return [];

    return data.map((row): MatchedVote => ({
      voteId: row.vote_id,
      title: row.title,
      itemId: Number(row.item_id),
      voteDate: row.vote_date,
      publicFor: Number(row.public_for ?? 0),
      publicAgainst: Number(row.public_against ?? 0),
      houseFor: Number(row.house_for ?? 0),
      houseAgainst: Number(row.house_against ?? 0),
      houseAbstain: Number(row.house_abstain ?? 0),
      houseAccepted: Boolean(row.house_accepted),
      publicSide: asSide(row.public_side),
      houseSide: asSide(row.house_side),
      memberStance: asStance(row.member_stance),
    }));
  }
);

/**
 * The house's own record - every item where the public and the chamber both
 * voted. The member function returns the same rows with a stance column, so
 * both pages print them through one component.
 */
export const houseMatchedVotes = cache(
  async (limit = 20): Promise<MatchedVote[]> => {
    const { data, error } = await supabaseAdmin.rpc('knesset_matched_votes_public', {
      p_limit: limit,
    });
    if (error || !data) return [];

    return data.map((row): MatchedVote => ({
      voteId: row.vote_id,
      title: row.title,
      itemId: Number(row.item_id),
      voteDate: row.vote_date,
      publicFor: Number(row.public_for ?? 0),
      publicAgainst: Number(row.public_against ?? 0),
      houseFor: Number(row.house_for ?? 0),
      houseAgainst: Number(row.house_against ?? 0),
      houseAbstain: Number(row.house_abstain ?? 0),
      houseAccepted: Boolean(row.house_accepted),
      publicSide: asSide(row.public_side),
      houseSide: asSide(row.house_side),
      memberStance: null,
    }));
  }
);

export interface MemberReviewsRead {
  reviewCount: number;
  ratingAverage: number | null;
  reviews: GovReview[];
}

/**
 * Published reviews of one member, plus the signed-in citizen's own row
 * whatever its status - so someone whose review was hidden still sees it and
 * can amend it, rather than being quietly told they never wrote one.
 *
 * Not request-memoised: the viewer is part of the answer, and caching a
 * viewer-shaped read is how one citizen ends up seeing another's row.
 */
export async function memberReviews(
  personId: number,
  viewerId: string | null
): Promise<MemberReviewsRead> {
  const { data, error } = await supabaseAdmin.rpc(
    'knesset_member_reviews_public',
    { p_person_id: personId, viewer: viewerId }
  );
  if (error || !data) return { reviewCount: 0, ratingAverage: null, reviews: [] };

  const reviews: GovReview[] = data.map((row) => ({
    id: row.review_id,
    rating: Number(row.rating),
    body: row.body,
    createdAt: row.created_at,
    isMine: Boolean(row.is_mine),
  }));

  /* Only published rows count toward the public figure. The RPC also returns
     the viewer's own row whatever its status - so a citizen whose review was
     hidden still sees and can amend it - but a hidden review is not evidence
     about the member and must not move their average. */
  const published = data.filter((row) => row.status === 'published');
  const average =
    published.length > 0
      ? Math.round(
          (published.reduce((sum, row) => sum + Number(row.rating), 0) /
            published.length) *
            100
        ) / 100
      : null;

  return { reviewCount: published.length, ratingAverage: average, reviews };
}

/** One member by URL slug, from the roster read. */
export async function knessetMemberBySlug(
  slug: string
): Promise<KnessetMember | null> {
  const roster = await knessetRoster();
  return roster.find((member) => member.slug === slug) ?? null;
}
