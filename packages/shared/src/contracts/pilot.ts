/**
 * Contract surface for the pilot program.
 *
 * Same doctrine as spaceAdmin.ts: allow-lists live here, deliberately separate
 * from database row types, and the whole phase sits in one file so later plans
 * import without reopening anything shared.
 *
 * Zod v3 (`^3.23.0`) — respond.ts reads `error.issues`; do not migrate this
 * file to v4 syntax in isolation.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const PilotRoleSchema = z.enum(['participant', 'observer']);

export const PilotCohortStatusSchema = z.enum([
  'selected',
  'active',
  'paused',
  'completed',
]);

export const PilotCampaignStatusSchema = z.enum([
  'draft',
  'ready',
  'posted',
  'archived',
]);

/** Israel's bounding box. Coordinates outside it are a validation error, not a lookup miss. */
const LatitudeSchema = z.number().min(29).max(34);
const LongitudeSchema = z.number().min(33.5).max(36);

const CoordsSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  accuracyM: z.number().nonnegative().max(100000).optional(),
});

// ---------------------------------------------------------------------------
// Public: registration
// ---------------------------------------------------------------------------

/**
 * Coordinates are refused unless the explicit consent flag rides with them —
 * the pilot flow, unlike GeoGate, sends location to the server, and that
 * promise difference is enforced structurally before any repo sees the body.
 */
export const PilotRegisterRequestSchema = z
  .object({
    role: PilotRoleSchema,
    coords: CoordsSchema.optional(),
    /** Must be literally true when coords are present. */
    locationConsent: z.literal(true).optional(),
    /** Version tag of the consent copy the user was shown, e.g. 'pilot-gps-v1'. */
    consentVersion: z.string().trim().min(1).max(40).optional(),
    /** Manual fallback when GPS is denied or resolves nowhere. */
    municipalityId: z.string().trim().min(1).max(100).optional(),
    /** Attribution fallback when the taruu_ref cookie did not survive. */
    refCode: z
      .string()
      .regex(/^[a-z0-9]{8}$/)
      .optional(),
  })
  .refine((body) => !body.coords || body.locationConsent === true, {
    message: 'coordinates require explicit location consent',
    path: ['locationConsent'],
  })
  .refine((body) => !body.coords || Boolean(body.consentVersion), {
    message: 'coordinates require the consent copy version',
    path: ['consentVersion'],
  });

export const PilotResolutionSchema = z.enum(['gps', 'manual', 'profile', 'none']);

export const PilotRegisterResponseSchema = z.object({
  role: PilotRoleSchema,
  resolvedMunicipality: z.string().nullable(),
  claimedMunicipality: z.string().nullable(),
  gpsMunicipality: z.string().nullable(),
  locationMismatch: z.boolean(),
  resolution: PilotResolutionSchema,
  isPilotMunicipality: z.boolean(),
});

export const PilotStatusVoteSchema = z.object({
  voteId: z.string().uuid(),
  title: z.string(),
  position: z.number().int().min(1).max(5),
  participantCount: z.number().int().nonnegative(),
});

export const PilotStatusMunicipalitySchema = z.object({
  municipalityId: z.string(),
  rank: z.number().int().nullable(),
  votes: z.array(PilotStatusVoteSchema),
});

export const PilotStatusResponseSchema = z.object({
  municipalities: z.array(PilotStatusMunicipalitySchema),
});

// ---------------------------------------------------------------------------
// Admin: cohort curation
// ---------------------------------------------------------------------------

export const CurateCohortRequestSchema = z.object({
  entries: z
    .array(
      z.object({
        municipalityId: z.string().trim().min(1).max(100),
        rank: z.number().int().min(1).max(10),
      })
    )
    .min(1)
    .max(10)
    .refine(
      (entries) => new Set(entries.map((entry) => entry.rank)).size === entries.length,
      { message: 'ranks must be unique' }
    )
    .refine(
      (entries) =>
        new Set(entries.map((entry) => entry.municipalityId)).size === entries.length,
      { message: 'municipalities must be unique' }
    ),
});

export const SetPilotVotesRequestSchema = z.object({
  votes: z
    .array(
      z.object({
        voteId: z.string().uuid(),
        position: z.number().int().min(1).max(5),
      })
    )
    .length(5)
    .refine(
      (votes) => new Set(votes.map((vote) => vote.position)).size === votes.length,
      { message: 'positions must be unique' }
    ),
  /** Applied to still-pending ingested votes on activation. ISO datetime. */
  endDate: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Admin: campaigns, copy, mark-posted
// ---------------------------------------------------------------------------

const FacebookUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => /^https:\/\/(www\.|m\.)?facebook\.com\//i.test(url),
    { message: 'must be a facebook.com URL' }
  );

export const CreateCampaignRequestSchema = z.object({
  municipalityId: z.string().trim().min(1).max(100),
  groupName: z.string().trim().min(1).max(200),
  groupUrl: FacebookUrlSchema.optional(),
});

export const SaveCopyRequestSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const MarkPostedRequestSchema = z.object({
  permalink: FacebookUrlSchema,
});

export const PilotCopySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  body: z.string(),
  author: z.enum(['llm', 'human']),
  model: z.string().nullable(),
  createdAt: z.string(),
});

export const PilotCampaignSchema = z.object({
  id: z.string().uuid(),
  municipalityId: z.string(),
  groupName: z.string(),
  groupUrl: z.string().nullable(),
  status: PilotCampaignStatusSchema,
  linkCode: z.string().nullable(),
  currentCopy: PilotCopySchema.nullable(),
  postedAt: z.string().nullable(),
  postPermalink: z.string().nullable(),
  createdAt: z.string(),
});

export const DraftCopyResponseSchema = z.object({
  copy: PilotCopySchema,
});

// ---------------------------------------------------------------------------
// Admin: stats
// ---------------------------------------------------------------------------

export const PilotRankingRowSchema = z.object({
  municipalityId: z.string(),
  voteCount: z.number().int().nonnegative(),
  postCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  reactionsCount: z.number().int().nonnegative(),
  score: z.number().nonnegative(),
  /** Overlay of the current cohort row, when one exists. */
  cohort: z
    .object({ rank: z.number().int().nullable(), status: PilotCohortStatusSchema })
    .nullable(),
});

export const PilotOverviewRowSchema = z.object({
  municipalityId: z.string(),
  rank: z.number().int().nullable(),
  status: PilotCohortStatusSchema,
  campaigns: z.number().int().nonnegative(),
  postedCampaigns: z.number().int().nonnegative(),
  humanClicks: z.number().int().nonnegative(),
  registrations: z.number().int().nonnegative(),
  participants: z.number().int().nonnegative(),
  ballots: z.number().int().nonnegative(),
});

export const PilotLinkDayStatSchema = z.object({
  day: z.string(),
  totalClicks: z.number().int().nonnegative(),
  humanClicks: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
});

export const PilotFunnelSchema = z.object({
  clicks: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  registrations: z.number().int().nonnegative(),
  participants: z.number().int().nonnegative(),
  ballots: z.number().int().nonnegative(),
});

export const PilotAuditEntrySchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid(),
  municipalityId: z.string().nullable(),
  action: z.string(),
  objectType: z.enum(['cohort', 'campaign', 'copy', 'link', 'vote_set']),
  objectId: z.string().nullable(),
  priorState: z.unknown().nullable(),
  newState: z.unknown().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type PilotRole = z.infer<typeof PilotRoleSchema>;
export type PilotCohortStatus = z.infer<typeof PilotCohortStatusSchema>;
export type PilotCampaignStatus = z.infer<typeof PilotCampaignStatusSchema>;
export type PilotResolution = z.infer<typeof PilotResolutionSchema>;
export type PilotRegisterRequest = z.infer<typeof PilotRegisterRequestSchema>;
export type PilotRegisterResponse = z.infer<typeof PilotRegisterResponseSchema>;
export type PilotStatusResponse = z.infer<typeof PilotStatusResponseSchema>;
export type CurateCohortRequest = z.infer<typeof CurateCohortRequestSchema>;
export type SetPilotVotesRequest = z.infer<typeof SetPilotVotesRequestSchema>;
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;
export type SaveCopyRequest = z.infer<typeof SaveCopyRequestSchema>;
export type MarkPostedRequest = z.infer<typeof MarkPostedRequestSchema>;
export type PilotCopy = z.infer<typeof PilotCopySchema>;
export type PilotCampaign = z.infer<typeof PilotCampaignSchema>;
export type DraftCopyResponse = z.infer<typeof DraftCopyResponseSchema>;
export type PilotRankingRow = z.infer<typeof PilotRankingRowSchema>;
export type PilotOverviewRow = z.infer<typeof PilotOverviewRowSchema>;
export type PilotLinkDayStat = z.infer<typeof PilotLinkDayStatSchema>;
export type PilotFunnel = z.infer<typeof PilotFunnelSchema>;
export type PilotAuditEntry = z.infer<typeof PilotAuditEntrySchema>;
