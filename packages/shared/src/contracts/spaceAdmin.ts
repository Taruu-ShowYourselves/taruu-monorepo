/**
 * Contract surface for the space-admin dashboard (issue #75).
 *
 * Deliberately keep these allow-lists separate from database row types. Adding
 * a private database column can therefore never add it to a response — the
 * response shape is a decision made here, not a projection of storage.
 *
 * This is the whole phase in one file on purpose: seven later plans import from
 * it and none of them has to reopen a shared file to add a shape.
 *
 * Zod v3 (`^3.23.0`). `parse()` in the server's respond.ts reads `error.issues`,
 * which is the v3 shape — do not migrate this file to v4 syntax in isolation.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * Every authority-changing action carries a reason (SPACE-04). The dialog
 * requires at least 10 characters and shows an {n}/500 counter.
 *
 * `.trim()` runs before `.min()` in zod v3, so a whitespace-only reason fails
 * here as a VALIDATION error rather than reaching the database CHECK and
 * surfacing as a 500.
 */
export const ReasonSchema = z.string().trim().min(10).max(500);

/** The eleven capability identifiers. Mirrors the server-side vocabulary. */
export const CapabilitySchema = z.enum([
  'proposal.read',
  'proposal.approve',
  'proposal.reject',
  'member.read',
  'member.suspend',
  'grant.create',
  'grant.revoke',
  'content.moderate',
  'metrics.read',
  'notification.send',
  'audit.read',
]);

/** Role presets are expanded at grant time; they are never stored authority. */
export const RolePresetSchema = z.enum([
  'space_admin',
  'space_reviewer',
  'space_moderator',
  'space_communicator',
  'space_observer',
]);

// ---------------------------------------------------------------------------
// Proposal review + content moderation
// ---------------------------------------------------------------------------

export const DecisionSchema = z.enum(['approve', 'reject', 'request_changes']);

export const DecideProposalRequestSchema = z.object({
  decision: DecisionSchema,
  reason: ReasonSchema,
});

export const ContentActionSchema = z.enum(['hide', 'unhide', 'flag', 'unflag']);

export const ModerateContentRequestSchema = z.object({
  action: ContentActionSchema,
  reason: ReasonSchema,
});

// ---------------------------------------------------------------------------
// Grants, suspension, and the platform-admin action
// ---------------------------------------------------------------------------

export const GrantCapabilityRequestSchema = z.object({
  userId: z.string().uuid(),
  capability: CapabilitySchema,
  /** Provenance for the UI only — the grant row is what confers authority. */
  grantedViaRole: RolePresetSchema.optional(),
  reason: ReasonSchema,
});

export const RevokeCapabilityRequestSchema = z.object({
  userId: z.string().uuid(),
  capability: CapabilitySchema,
  reason: ReasonSchema,
});

export const SuspendMemberRequestSchema = z.object({
  userId: z.string().uuid(),
  reason: ReasonSchema,
});

export const ReinstateMemberRequestSchema = z.object({
  userId: z.string().uuid(),
  reason: ReasonSchema,
});

/** Platform-admin action: suspend a single grant without deleting any history. */
export const SuspendGrantRequestSchema = z.object({
  grantId: z.string().uuid(),
  reason: ReasonSchema,
});

export type Reason = z.infer<typeof ReasonSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type RolePreset = z.infer<typeof RolePresetSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type DecideProposalRequest = z.infer<typeof DecideProposalRequestSchema>;
export type ContentAction = z.infer<typeof ContentActionSchema>;
export type ModerateContentRequest = z.infer<typeof ModerateContentRequestSchema>;
export type GrantCapabilityRequest = z.infer<typeof GrantCapabilityRequestSchema>;
export type RevokeCapabilityRequest = z.infer<typeof RevokeCapabilityRequestSchema>;
export type SuspendMemberRequest = z.infer<typeof SuspendMemberRequestSchema>;
export type ReinstateMemberRequest = z.infer<typeof ReinstateMemberRequestSchema>;
export type SuspendGrantRequest = z.infer<typeof SuspendGrantRequestSchema>;

// ---------------------------------------------------------------------------
// Notification composer (SPACE-08)
// ---------------------------------------------------------------------------

export const AudienceFilterSchema = z.enum([
  'all_members',
  'active_vote_participants',
  'new_members_30d',
]);

/** 60/300 are the composer field hints — `עד 60 תווים` / `עד 300 תווים`. */
export const PreviewAudienceRequestSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(300),
  audienceFilter: AudienceFilterSchema,
});

/**
 * All four Receipt rows are always present, zeros included: a missing row reads
 * as "not checked", which is exactly the ambiguity the preview exists to remove.
 *
 * `quotaUsed`/`quotaLimit` are a **calendar-month** window — the UI row reads
 * `מכסה חודשית` and the exhausted block names a reset date. Not a rolling day.
 */
export const AudiencePreviewResponseSchema = z.object({
  campaignId: z.string().uuid(),
  previewToken: z.string(),
  approvedRecipients: z.number().int().nonnegative(),
  excludedOptedOut: z.number().int().nonnegative(),
  excludedNoChannel: z.number().int().nonnegative(),
  quotaUsed: z.number().int().nonnegative(),
  quotaLimit: z.number().int().nonnegative(),
  computedAt: z.string(),
});

/**
 * The send must carry the same payload the preview was computed from. The
 * server re-derives the token and refuses a mismatch, so the client cannot
 * send an audience different from the one it displayed.
 */
export const SendNotificationRequestSchema = PreviewAudienceRequestSchema.extend({
  campaignId: z.string().uuid(),
  previewToken: z.string().min(1),
  reason: ReasonSchema,
});

/** Feeds the sent Receipt: נמענים · זמן שליחה · מזהה משלוח · מכסה שנותרה. */
export const SendNotificationResponseSchema = z.object({
  campaignId: z.string().uuid(),
  deliveredRecipients: z.number().int().nonnegative(),
  sentAt: z.string(),
  quotaRemaining: z.number().int().nonnegative(),
});

/**
 * Quota state for composer state 0, before any preview exists. Separate from
 * the preview response because `QuotaBlock` renders the reset date with no
 * campaign in flight. Calendar month, per the `מכסה חודשית` copy.
 */
export const SpaceNotificationQuotaSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  resetsAt: z.string(),
});

/**
 * Escalation to a platform admin (SPACE-09). Exempt from the per-space
 * notification quota — a suspended admin must always be able to escalate.
 *
 * Note there is deliberately **no `escalation.raised` audit action**: an
 * escalation writes only to `platform_escalations`. Any authenticated user can
 * raise one, the space audit log is append-only, and rows written there could
 * never be cleaned up — so escalations would be permanent pollution in an
 * arbitrary space. Do not add one.
 */
export const EscalationRequestSchema = z.object({
  body: z.string().trim().min(10).max(2000),
});

export const EscalationResponseSchema = z.object({
  escalationId: z.string().uuid(),
  createdAt: z.string(),
});

export type AudienceFilter = z.infer<typeof AudienceFilterSchema>;
export type PreviewAudienceRequest = z.infer<typeof PreviewAudienceRequestSchema>;
export type AudiencePreviewResponse = z.infer<typeof AudiencePreviewResponseSchema>;
export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;
export type SendNotificationResponse = z.infer<typeof SendNotificationResponseSchema>;
export type SpaceNotificationQuota = z.infer<typeof SpaceNotificationQuotaSchema>;
export type EscalationRequest = z.infer<typeof EscalationRequestSchema>;
export type EscalationResponse = z.infer<typeof EscalationResponseSchema>;

// ---------------------------------------------------------------------------
// Aggregate statistics (SPACE-07)
// ---------------------------------------------------------------------------

/**
 * `suppressed` is the k-anonymity floor of 5: a bucket holding 1–4 residents
 * renders `<5` and the client never receives the true number. `unavailable`
 * renders `—`. A real zero is `{ value: 0, status: 'available' }` — the UI must
 * never invent a fallback zero, because a fabricated 0 is indistinguishable
 * from a measured one.
 */
export const SpaceMetricSchema = z.object({
  value: z.number().int().nonnegative().nullable(),
  status: z.enum(['available', 'suppressed', 'unavailable']),
});

export const SpaceMetricsResponseSchema = z.object({
  registeredResidents: SpaceMetricSchema,
  activeParticipants30d: SpaceMetricSchema,
  proposalsSubmitted: SpaceMetricSchema,
  participationRate: SpaceMetricSchema,
  generatedAt: z.string(),
});

export type SpaceMetric = z.infer<typeof SpaceMetricSchema>;
export type SpaceMetricsResponse = z.infer<typeof SpaceMetricsResponseSchema>;

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * The privacy allow-list for the members surface. Exactly the fields needed to
 * administer a space and nothing more: no contact channel, no national
 * identifier, no DID, and nothing whatsoever derived from `identity_documents`.
 *
 * This list is the enforcement point. Widening it is a privacy decision, not a
 * convenience — the surface copy promises `מסמכי זהות אינם נגישים מלוח זה`.
 */
export const SpaceMemberSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  municipality: z.string(),
  joinedAt: z.string(),
  verificationStatus: z.enum(['none', 'pending', 'verified', 'failed']),
  identityVerified: z.boolean(),
  suspended: z.boolean(),
  capabilities: z.array(CapabilitySchema),
});

/** The members surface shows a real total: `{n} חברים במרחב`. */
export const SpaceMemberListResponseSchema = z.object({
  members: z.array(SpaceMemberSchema),
  total: z.number().int().nonnegative(),
});

export type SpaceMember = z.infer<typeof SpaceMemberSchema>;
export type SpaceMemberListResponse = z.infer<typeof SpaceMemberListResponseSchema>;

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

/** The four review labels plus the three publication states a decision lands in. */
export const ProposalStatusSchema = z.enum([
  'draft',
  'in_review',
  'changes_requested',
  'rejected',
  'pending',
  'active',
  'ended',
]);

export const ProposalSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: ProposalStatusSchema,
  submitterId: z.string().uuid(),
  submitterDisplayName: z.string(),
  submittedAt: z.string(),
  hidden: z.boolean(),
  flagged: z.boolean(),
  /** Server-resolved: the viewer submitted this, so the decision actions are absent. */
  selfSubmitted: z.boolean(),
});

export const ProposalDetailSchema = ProposalSummarySchema.extend({
  body: z.string(),
  hiddenAt: z.string().nullable(),
  flaggedAt: z.string().nullable(),
});

export const ProposalListResponseSchema = z.object({
  proposals: z.array(ProposalSummarySchema),
});

export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>;
export type ProposalDetail = z.infer<typeof ProposalDetailSchema>;
export type ProposalListResponse = z.infer<typeof ProposalListResponseSchema>;

// ---------------------------------------------------------------------------
// Audit history (SPACE-04)
// ---------------------------------------------------------------------------

export const AuditRowSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  actorId: z.string().uuid(),
  actorDisplayName: z.string(),
  action: z.string(),
  objectType: z.string(),
  objectId: z.string().nullable(),
  priorState: z.unknown().nullable(),
  newState: z.unknown().nullable(),
  reason: z.string(),
});

/**
 * Cursor pagination on `(created_at, id)`, and deliberately **no total**: the
 * log is append-only and continuously written, so an offset page duplicates or
 * skips rows as new entries land, and a count is expensive and stale on arrival.
 */
export const AuditPageSchema = z.object({
  rows: z.array(AuditRowSchema),
  nextCursor: z.string().nullable(),
  truncated: z.boolean(),
});

export type AuditRow = z.infer<typeof AuditRowSchema>;
export type AuditPage = z.infer<typeof AuditPageSchema>;

// ---------------------------------------------------------------------------
// Space shell
// ---------------------------------------------------------------------------

export const SpaceSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameHe: z.string(),
  /**
   * Kept a plain string rather than an enum: the concrete type list lives in
   * the DDL, and #74 adds rows to it. A duplicated enum here would fork.
   */
  type: z.string(),
  /** First 8 chars of the uuid, for the edition meta line. */
  shortId: z.string(),
  suspended: z.boolean(),
  /** What this viewer holds here — drives the capability manifest and Rule A. */
  capabilities: z.array(CapabilitySchema),
});

export type SpaceSummary = z.infer<typeof SpaceSummarySchema>;
