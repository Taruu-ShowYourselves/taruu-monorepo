/**
 * Row → contract mappers for the authz tables.
 *
 * Pure and dependency-free by design. Both `submit-application.ts` (plan 05-05)
 * and `review-application.ts` (plan 05-06) import from here; neither declares a
 * local copy, so the applicant view and the admin view of the same row cannot
 * disagree.
 */
import type { ManagerApplication, RoleGrantSummary } from '@sync/shared/contracts';
import type { CommunityManagerApplication, RoleGrant } from '@/lib/supabase/types';

export function toManagerApplication(row: CommunityManagerApplication): ManagerApplication {
  return {
    id: row.id,
    spaceId: row.space_id,
    status: row.status,
    motivation: row.motivation,
    evidenceUrls: Array.isArray(row.evidence_urls) ? (row.evidence_urls as string[]) : [],
    reviewedAt: row.reviewed_at,
    reviewReason: row.review_reason,
    createdAt: row.created_at,
  };
}

export function toGrantSummary(row: RoleGrant): RoleGrantSummary {
  return {
    id: row.id,
    role: row.role,
    spaceId: row.space_id,
    status: row.status,
    grantedAt: row.granted_at,
  };
}
