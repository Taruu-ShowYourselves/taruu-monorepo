/**
 * RBAC contracts (Phase 5 / GitHub issue #79a).
 *
 * "Space" is a `municipalities.code` value (Hebrew string), including the
 * national pseudo-space KNESSET_SCOPE. `super_admin` is platform-wide and
 * carries spaceId === null.
 */

import { z } from 'zod';

// === Vocabulary ===

export const RoleNameSchema = z.enum([
  'super_admin',
  'space_admin',
  'community_manager',
]);
export type RoleName = z.infer<typeof RoleNameSchema>;

export const RoleGrantStatusSchema = z.enum(['active', 'suspended', 'revoked']);
export type RoleGrantStatus = z.infer<typeof RoleGrantStatusSchema>;

export const RoleGrantSourceSchema = z.enum(['manual', 'application']);
export type RoleGrantSource = z.infer<typeof RoleGrantSourceSchema>;

export const ManagerApplicationStatusSchema = z.enum([
  'submitted',
  'approved',
  'rejected',
  'withdrawn',
]);
export type ManagerApplicationStatus = z.infer<typeof ManagerApplicationStatusSchema>;

export const AuditSubjectTypeSchema = z.enum([
  'role_grant',
  'community_manager_application',
]);
export type AuditSubjectType = z.infer<typeof AuditSubjectTypeSchema>;

export const RoleAuditEventSchema = z.enum([
  'submitted',
  'approved',
  'rejected',
  'granted',
  'suspended',
  'reinstated',
  'revoked',
]);
export type RoleAuditEvent = z.infer<typeof RoleAuditEventSchema>;

/** A municipalities.code value. Hebrew, so no charset restriction. */
export const SpaceIdSchema = z.string().trim().min(1).max(64);

/** Every recorded decision carries a reason (RBAC-03). */
export const ReviewReasonSchema = z.string().trim().min(10).max(1000);

// === Shared views ===

export const RoleGrantSummarySchema = z.object({
  id: z.string().uuid(),
  role: RoleNameSchema,
  spaceId: z.string().nullable(),
  status: RoleGrantStatusSchema,
  grantedAt: z.string(),
});
export type RoleGrantSummary = z.infer<typeof RoleGrantSummarySchema>;

export const ManagerApplicationSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string(),
  status: ManagerApplicationStatusSchema,
  motivation: z.string(),
  evidenceUrls: z.array(z.string()),
  reviewedAt: z.string().nullable(),
  reviewReason: z.string().nullable(),
  createdAt: z.string(),
});
export type ManagerApplication = z.infer<typeof ManagerApplicationSchema>;

// === POST /api/manager-applications (applicant) ===

export const SubmitManagerApplicationRequestSchema = z.object({
  spaceId: SpaceIdSchema,
  motivation: z.string().trim().min(40).max(2000),
  contactPhone: z.string().trim().max(32).optional(),
  evidenceUrls: z.array(z.string().url().max(300)).max(5).default([]),
});
export type SubmitManagerApplicationRequest = z.infer<
  typeof SubmitManagerApplicationRequestSchema
>;

export const SubmitManagerApplicationResponseSchema = z.object({
  application: ManagerApplicationSchema,
});
export type SubmitManagerApplicationResponse = z.infer<
  typeof SubmitManagerApplicationResponseSchema
>;

// === GET /api/manager-applications (applicant) ===

export const GetManagerApplicationResponseSchema = z.object({
  application: ManagerApplicationSchema.nullable(),
  grants: z.array(RoleGrantSummarySchema),
});
export type GetManagerApplicationResponse = z.infer<
  typeof GetManagerApplicationResponseSchema
>;

// === GET /api/admin/manager-applications (reviewer) ===

export const PendingManagerApplicationSchema = ManagerApplicationSchema.extend({
  contactPhone: z.string().nullable(),
  applicant: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    municipality: z.string().nullable(),
  }),
});
export type PendingManagerApplication = z.infer<typeof PendingManagerApplicationSchema>;

export const ListPendingApplicationsResponseSchema = z.object({
  scope: z.union([
    z.object({ kind: z.literal('platform') }),
    z.object({ kind: z.literal('spaces'), spaceIds: z.array(z.string()) }),
  ]),
  applications: z.array(PendingManagerApplicationSchema),
});
export type ListPendingApplicationsResponse = z.infer<
  typeof ListPendingApplicationsResponseSchema
>;

// === POST /api/admin/manager-applications/[id] (approve | reject) ===

export const ReviewDecisionSchema = z.enum(['approve', 'reject']);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewApplicationRequestSchema = z.object({
  decision: ReviewDecisionSchema,
  reason: ReviewReasonSchema,
});
export type ReviewApplicationRequest = z.infer<typeof ReviewApplicationRequestSchema>;

export const ReviewApplicationResponseSchema = z.object({
  application: ManagerApplicationSchema,
  /** Non-null on approve: the grant created. Approval alone authorizes nothing. */
  grant: RoleGrantSummarySchema.nullable(),
});
export type ReviewApplicationResponse = z.infer<typeof ReviewApplicationResponseSchema>;

// === POST /api/admin/role-grants/[id] (suspend | reinstate | revoke) ===

export const GrantActionSchema = z.enum(['suspend', 'reinstate', 'revoke']);
export type GrantAction = z.infer<typeof GrantActionSchema>;

export const GrantActionRequestSchema = z.object({
  action: GrantActionSchema,
  reason: ReviewReasonSchema,
});
export type GrantActionRequest = z.infer<typeof GrantActionRequestSchema>;

export const GrantActionResponseSchema = z.object({
  grant: RoleGrantSummarySchema,
});
export type GrantActionResponse = z.infer<typeof GrantActionResponseSchema>;
