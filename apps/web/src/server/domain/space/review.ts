/**
 * Proposal review - pure transition rules.
 *
 * `pending` in this codebase means "scheduled, has not started yet"; it has
 * never meant "awaiting approval". The review states are separate labels and
 * this module is the only place that says which transitions are legal.
 *
 * Pure: the only import is `initialStatus`, itself pure, so approval reuses
 * the existing publication-time rule rather than restating it.
 */

import { initialStatus } from '@/server/domain/votes/vote';

export const REVIEW_VOTE_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'rejected',
] as const;
export type ReviewVoteStatus = (typeof REVIEW_VOTE_STATUSES)[number];

export const DECISIONS = ['approve', 'reject', 'request_changes'] as const;
export type Decision = (typeof DECISIONS)[number];

/** Only a proposal actually under review may be decided. */
export const isDecidableFrom = (status: string): status is 'in_review' =>
  status === 'in_review';

/** Where a decision moves the row. Approval reuses the existing schedule rule. */
export function resolveDecisionTarget(
  decision: Decision,
  startDate: Date,
  now: Date
): 'active' | 'pending' | 'rejected' | 'changes_requested' {
  switch (decision) {
    case 'approve':
      return initialStatus(startDate, now);
    case 'reject':
      return 'rejected';
    case 'request_changes':
      return 'changes_requested';
  }
}

/** A reviewer may not decide a proposal they submitted. */
export const reviewerMayDecide = (a: {
  submitterId: string;
  reviewerId: string;
}): boolean => a.submitterId !== a.reviewerId;

/** The audit `action` string for a decision. Stable - the audit log is append-only. */
export const auditActionFor = (d: Decision): string =>
  d === 'approve'
    ? 'proposal.approved'
    : d === 'reject'
      ? 'proposal.rejected'
      : 'proposal.changes_requested';

/**
 * The capability a decision requires. `request_changes` rides with `reject`:
 * both decline to publish, and only `approve` publishes. See capability.ts for
 * why this is not a twelfth capability.
 */
export const capabilityFor = (d: Decision): 'proposal.approve' | 'proposal.reject' =>
  d === 'approve' ? 'proposal.approve' : 'proposal.reject';

/** Status chip labels for the proposals surface - server and UI cannot drift. */
export const REVIEW_STATUS_LABELS_HE: Record<ReviewVoteStatus | 'active', string> = {
  draft: 'טיוטה',
  in_review: 'בבדיקה',
  changes_requested: 'הוחזרה לתיקון',
  rejected: 'נדחתה',
  active: 'אושרה ופורסמה',
};
