/**
 * Government contracts - the Knesset roster, its roll-call record, and the
 * civic scores a citizen reads it by.
 *
 * Two rules carry through every schema here, both borrowed from the authority
 * contracts and both load-bearing:
 *
 *  1. Every claim about a living person carries its source. The roster is
 *     mirrored from the Knesset's own OData service, and a row that cannot
 *     name where it came from has no business being printed.
 *  2. A score is either measured or it is null. Never zero. Zero on a signed
 *     scale is a measurement - "this member votes with the public exactly as
 *     often as against it" - and a member with no matched votes has not
 *     earned that statement.
 */

import { z } from 'zod';
import { CIVIC_SCORE_MAX, CIVIC_SCORE_MIN } from './municipality';

// === Sourcing ===

export const GovSourceSchema = z.object({
  /** Human-readable publisher, e.g. 'הכנסת · ParliamentInfo OData'. */
  name: z.string().min(2),
  url: z.string().url(),
  /** The date the claim was true upstream. */
  asOf: z.string(),
});

export type GovSource = z.infer<typeof GovSourceSchema>;

// === Offices ===

/**
 * The offices the Knesset's own position table publishes, collapsed to one
 * entry per office rather than one per grammatical gender - the upstream list
 * carries 'שר' and 'שרה' as separate positions, which is a fact about Hebrew
 * and not about government.
 */
export const GovOfficeSchema = z.enum([
  'pm', // ראש הממשלה
  'alternate_pm', // ראש הממשלה החילופי
  'deputy_pm', // סגן/משנה לראש הממשלה
  'minister', // שר/ה
  'deputy_minister', // סגן/ית שר
  'speaker', // יו"ר הכנסת
  'deputy_speaker', // סגן/ית יו"ר הכנסת
  'opposition_leader', // ראש/ת האופוזיציה
  'coalition_chair', // יו"ר הקואליציה
  'faction_chair', // יו"ר סיעה
  'committee_chair', // יו"ר ועדה
  'committee_member', // חבר/ת ועדה
  'mk', // חבר/ת הכנסת
]);

export type GovOffice = z.infer<typeof GovOfficeSchema>;

/** Ranking order for printing a member's offices, highest standing first. */
export const GOV_OFFICE_ORDER: readonly GovOffice[] = [
  'pm',
  'alternate_pm',
  'deputy_pm',
  'minister',
  'deputy_minister',
  'speaker',
  'deputy_speaker',
  'opposition_leader',
  'coalition_chair',
  'faction_chair',
  'committee_chair',
  'committee_member',
  'mk',
] as const;

export const GovPositionSchema = z.object({
  office: GovOfficeSchema,
  /** The upstream description, kept verbatim for the source line. */
  title: z.string(),
  /** Ministry for a minister, committee for a committee office; else null. */
  portfolio: z.string().nullable(),
  factionName: z.string().nullable(),
  knessetNum: z.number().int().positive().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

export type GovPosition = z.infer<typeof GovPositionSchema>;

// === Scores ===

const GovScoreSchema = z
  .number()
  .int()
  .min(CIVIC_SCORE_MIN)
  .max(CIVIC_SCORE_MAX)
  /** null = not measured yet; never coerced to 0. */
  .nullable();

/**
 * What a citizen can measure about the people who govern them.
 *
 * `alignment` is the one that does not exist at municipal level and is the
 * reason this page is worth printing: for every plenum item Taruu published
 * as a national ballot, the public reached a majority and the house held a
 * roll call. This is how often the two agreed.
 */
export const GovMemberScoresSchema = z.object({
  /** Voted the public's way, over matched roll calls. */
  alignmentScore: GovScoreSchema,
  /** Took a recorded side, over the roll calls of their term. */
  participationScore: GovScoreSchema,
  /** Citizens' 1-5 rating, on the shared signed scale. */
  trustScore: GovScoreSchema,
  /** Weighted mean of whichever of the three were measured. */
  overallScore: GovScoreSchema,
  /** Roll calls this member's alignment was computed over. */
  matchedVotes: z.number().int().nonnegative(),
  /** Roll calls in the term used as the participation denominator. */
  rollCalls: z.number().int().nonnegative(),
  /** Roll calls in which they took a recorded side. */
  recordedVotes: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  ratingAverage: z.number().min(1).max(5).nullable(),
});

export type GovMemberScores = z.infer<typeof GovMemberScoresSchema>;

// === A member ===

export const KnessetMemberSchema = z.object({
  /** Knesset ParliamentInfo PersonID - the upstream identity. */
  personId: z.number().int().positive(),
  /** Canonical Hebrew URL slug for /government/[slug]. */
  slug: z.string().min(1),
  fullName: z.string().min(2),
  firstName: z.string(),
  lastName: z.string(),
  /** Their faction right now, when the roster publishes one. */
  factionName: z.string().nullable(),
  /** Sitting offices, highest standing first. */
  positions: z.array(GovPositionSchema),
  /** Highest office held, for a one-line description. */
  topOffice: GovOfficeSchema,
  knessetNum: z.number().int().positive().nullable(),
  source: GovSourceSchema,
  scores: GovMemberScoresSchema,
});

export type KnessetMember = z.infer<typeof KnessetMemberSchema>;

// === The house ===

/**
 * The national counterpart of `MunicipalityCivicStats`. Same signed scale, so
 * a reader can hold a city and the Knesset side by side, plus the one axis a
 * city has no equivalent of.
 */
export const GovernmentCivicStatsSchema = z.object({
  knessetNum: z.number().int().positive().nullable(),
  /** Members currently sitting, per the roster mirror. */
  members: z.number().int().nonnegative(),
  factions: z.number().int().nonnegative(),
  /** National ballots open on Taruu right now. */
  openTopics: z.number().int().nonnegative(),
  decidedTopics: z.number().int().nonnegative(),
  ballotsCounted: z.number().int().nonnegative(),
  /** Citizens registered on the platform. */
  platformUsers: z.number().int().nonnegative(),
  activeParticipants: z.number().int().nonnegative(),
  /** Items where both a public majority and a house roll call exist. */
  matchedItems: z.number().int().nonnegative(),
  /** Of those, how many the house decided the public's way. */
  agreedItems: z.number().int().nonnegative(),
  representationScore: GovScoreSchema,
  engagementScore: GovScoreSchema,
  cooperationScore: GovScoreSchema,
  trustScore: GovScoreSchema,
  overallScore: GovScoreSchema,
});

export type GovernmentCivicStats = z.infer<typeof GovernmentCivicStatsSchema>;

// === A matched item: the public's tally beside the house's ===

export const GovStanceSchema = z.enum(['for', 'against', 'abstain', 'absent']);
export type GovStance = z.infer<typeof GovStanceSchema>;

export const MatchedVoteSchema = z.object({
  /** Taruu's own ballot on this item. */
  voteId: z.string(),
  title: z.string(),
  /** Knesset plenum item id, the join key between the two records. */
  itemId: z.number().int(),
  voteDate: z.string().nullable(),
  publicFor: z.number().int().nonnegative(),
  publicAgainst: z.number().int().nonnegative(),
  houseFor: z.number().int().nonnegative(),
  houseAgainst: z.number().int().nonnegative(),
  houseAbstain: z.number().int().nonnegative(),
  houseAccepted: z.boolean(),
  /** Which way the public leaned; null on a dead tie or an empty ballot. */
  publicSide: z.enum(['for', 'against']).nullable(),
  /** Which way the house went; null when its own tally ties. */
  houseSide: z.enum(['for', 'against']).nullable(),
  /** How this member voted, when the item is read from a member's page. */
  memberStance: GovStanceSchema.nullable(),
});

export type MatchedVote = z.infer<typeof MatchedVoteSchema>;

// === Citizen reviews of an office holder ===

export const GOV_REVIEW_BODY_MIN = 10;
export const GOV_REVIEW_BODY_MAX = 1200;

export const SubmitGovReviewRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(GOV_REVIEW_BODY_MIN)
    .max(GOV_REVIEW_BODY_MAX)
    .nullable()
    .optional(),
});

export type SubmitGovReviewRequest = z.infer<typeof SubmitGovReviewRequestSchema>;

export const GovReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5),
  body: z.string().nullable(),
  createdAt: z.string(),
  /** True only for the signed-in reader's own review. Never a name. */
  isMine: z.boolean(),
});

export type GovReview = z.infer<typeof GovReviewSchema>;

export const GovReviewsResponseSchema = z.object({
  personId: z.number().int().positive(),
  reviewCount: z.number().int().nonnegative(),
  ratingAverage: z.number().min(1).max(5).nullable(),
  reviews: z.array(GovReviewSchema),
});

export type GovReviewsResponse = z.infer<typeof GovReviewsResponseSchema>;

/**
 * A 1-5 citizen rating on the shared -100..+100 civic scale.
 *
 * Anchored so that 3/5 - the middle of the rating widget - lands on 0 rather
 * than on +50. A page that printed a lukewarm house as "+50 trust" would be
 * lying with arithmetic.
 */
export function ratingToCivicScore(average: number): number {
  const clamped = Math.min(5, Math.max(1, average));
  return Math.round(((clamped - 1) / 4) * 200 - 100);
}
