/**
 * Authority network contracts — the kinds of local authority, how they border
 * one another, who holds their offices, and what residents make of them.
 *
 * Kept apart from council.ts, which is the public-metrics profile. These are
 * the relational facts about an authority rather than its measurements.
 */

import { z } from 'zod';

// === Kinds ===

/**
 * Israel's local government is not only cities. A regional council
 * (מועצה אזורית) administers settlements that have no municipal standing of
 * their own, and it is an authority in every sense the platform cares about:
 * it has residents, it has open topics, and someone runs it.
 */
export const AuthorityKindSchema = z.enum([
  'municipality', // עירייה
  'local_council', // מועצה מקומית
  'regional_council', // מועצה אזורית
  'settlement', // יישוב בתוך מועצה אזורית
  'national', // כנסת ישראל
]);

export type AuthorityKind = z.infer<typeof AuthorityKindSchema>;

/** Kinds that carry a civic desk of their own. The Knesset has its own. */
export const LOCAL_AUTHORITY_KINDS = [
  'municipality',
  'local_council',
  'regional_council',
  'settlement',
] as const satisfies readonly AuthorityKind[];

/**
 * The same list as a schema, for payloads that are local-only by construction.
 * `municipality_civic_stats()` filters `kind <> 'national'`, so a row from it
 * carrying `'national'` would mean the RPC broke its own contract - better to
 * fail the parse than to print the Knesset on a municipal dial.
 */
export const LocalAuthorityKindSchema = z.enum(LOCAL_AUTHORITY_KINDS);

export type LocalAuthorityKind = z.infer<typeof LocalAuthorityKindSchema>;

// === Provenance ===

/**
 * Where a published fact came from. The councils layer already refuses to
 * render a population without one of these; an office holder is a named
 * living person, so the database refuses to *store* one without it.
 */
export const AuthoritySourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  asOf: z.string(),
});

export type AuthoritySource = z.infer<typeof AuthoritySourceSchema>;

// === The network around one authority ===

export const AuthorityRelationSchema = z.enum([
  /** Shares a border. */
  'neighbour',
  /** The regional council this settlement sits inside. */
  'parent',
  /** A settlement this regional council administers. */
  'settlement',
]);

export type AuthorityRelation = z.infer<typeof AuthorityRelationSchema>;

export const AuthorityLinkSchema = z.object({
  relation: AuthorityRelationSchema,
  code: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: AuthorityKindSchema,
  /** Present on borders, which are a sourced claim; null on containment. */
  source: AuthoritySourceSchema.omit({ asOf: true }).nullable(),
});

export type AuthorityLink = z.infer<typeof AuthorityLinkSchema>;

// === Office holders ===

export const OfficeRoleSchema = z.enum([
  'mayor', // ראש עירייה
  'council_head', // ראש מועצה
  'deputy', // סגן ראש הרשות
  'ceo', // מנכ"ל
  'treasurer', // גזבר
  'engineer', // מהנדס הרשות
  'legal_advisor', // יועץ משפטי
  'ombudsman', // מבקר / נציב תלונות
]);

export type OfficeRole = z.infer<typeof OfficeRoleSchema>;

/**
 * Reviews are of a named public official, so the standing is deliberately
 * thin: a count and an average, never a reviewer. Who said what is not a
 * public fact and never leaves the database.
 */
export const OfficialStandingSchema = z.object({
  reviewCount: z.number().int().nonnegative(),
  /** 1-5, or null before anyone has reviewed. */
  ratingAverage: z.number().min(1).max(5).nullable(),
});

export type OfficialStanding = z.infer<typeof OfficialStandingSchema>;

export const OfficeHolderSchema = z.object({
  id: z.string().uuid(),
  councilCode: z.string(),
  role: OfficeRoleSchema,
  fullName: z.string().min(1),
  termStart: z.string().nullable(),
  termEnd: z.string().nullable(),
  /** Never nullable: an unsourced name is not storable, so it is not renderable. */
  source: AuthoritySourceSchema,
  standing: OfficialStandingSchema,
});

export type OfficeHolder = z.infer<typeof OfficeHolderSchema>;

// === Reviews ===

export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 1200;

export const OfficialReviewStatusSchema = z.enum([
  'published',
  /** Withheld by moderation; the row survives so the decision is auditable. */
  'hidden',
  /** Retracted by its author. */
  'removed',
]);

export type OfficialReviewStatus = z.infer<typeof OfficialReviewStatusSchema>;

/** What a resident submits. Residency is proved server-side, never claimed here. */
export const SubmitOfficialReviewSchema = z.object({
  officeHolderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN)
    .max(REVIEW_BODY_MAX)
    .nullable()
    .optional(),
});

export type SubmitOfficialReview = z.infer<typeof SubmitOfficialReviewSchema>;

/** A review as the public sees it — with no author attached. */
export const PublicOfficialReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().nullable(),
  createdAt: z.string(),
});

export type PublicOfficialReview = z.infer<typeof PublicOfficialReviewSchema>;
