import { describe, expect, it } from 'vitest';
import {
  DECISIONS,
  REVIEW_STATUS_LABELS_HE,
  REVIEW_VOTE_STATUSES,
  auditActionFor,
  capabilityFor,
  isDecidableFrom,
  resolveDecisionTarget,
  reviewerMayDecide,
} from './review';
import { isCapability } from './capability';

const NOW = new Date('2026-08-02T12:00:00Z');
const START_IN_FUTURE = new Date('2026-08-09T12:00:00Z');
const START_IN_PAST = new Date('2026-07-26T12:00:00Z');

describe('REVIEW_VOTE_STATUSES', () => {
  it('is exactly the four review labels', () => {
    expect(REVIEW_VOTE_STATUSES).toEqual([
      'draft',
      'in_review',
      'changes_requested',
      'rejected',
    ]);
  });

  it('does not include pending - pending means "scheduled", not "awaiting approval"', () => {
    expect(REVIEW_VOTE_STATUSES).not.toContain('pending');
  });
});

describe('isDecidableFrom', () => {
  it('accepts in_review', () => {
    expect(isDecidableFrom('in_review')).toBe(true);
  });

  it.each(['draft', 'changes_requested', 'rejected', 'active', 'ended'])(
    'refuses %s',
    (status) => {
      expect(isDecidableFrom(status)).toBe(false);
    }
  );

  it('refuses pending - a scheduled vote is published, not awaiting approval', () => {
    expect(isDecidableFrom('pending')).toBe(false);
  });
});

describe('resolveDecisionTarget', () => {
  it('publishes an approved proposal whose start date has arrived', () => {
    expect(resolveDecisionTarget('approve', START_IN_PAST, NOW)).toBe('active');
  });

  it('schedules an approved proposal that starts later', () => {
    expect(resolveDecisionTarget('approve', START_IN_FUTURE, NOW)).toBe('pending');
  });

  it('sends a rejection to rejected', () => {
    expect(resolveDecisionTarget('reject', START_IN_FUTURE, NOW)).toBe('rejected');
    expect(resolveDecisionTarget('reject', START_IN_PAST, NOW)).toBe('rejected');
  });

  it('sends a request for changes back to changes_requested', () => {
    expect(resolveDecisionTarget('request_changes', START_IN_FUTURE, NOW)).toBe(
      'changes_requested'
    );
  });

  it.each(DECISIONS)('is total over the decision set - %s', (decision) => {
    expect([
      'active',
      'pending',
      'rejected',
      'changes_requested',
    ]).toContain(resolveDecisionTarget(decision, START_IN_FUTURE, NOW));
  });
});

describe('reviewerMayDecide', () => {
  it('refuses a reviewer their own submission', () => {
    expect(reviewerMayDecide({ submitterId: 'u1', reviewerId: 'u1' })).toBe(false);
  });

  it('allows a different reviewer', () => {
    expect(reviewerMayDecide({ submitterId: 'u1', reviewerId: 'u2' })).toBe(true);
  });
});

describe('auditActionFor', () => {
  it.each([
    ['approve', 'proposal.approved'],
    ['reject', 'proposal.rejected'],
    ['request_changes', 'proposal.changes_requested'],
  ] as const)('maps %s to %s', (decision, action) => {
    expect(auditActionFor(decision)).toBe(action);
  });
});

describe('capabilityFor', () => {
  it('requires proposal.approve only to approve', () => {
    expect(capabilityFor('approve')).toBe('proposal.approve');
  });

  it('rides request_changes along with reject - there is no twelfth capability', () => {
    expect(capabilityFor('reject')).toBe('proposal.reject');
    expect(capabilityFor('request_changes')).toBe('proposal.reject');
  });

  it.each(DECISIONS)('returns a member of the capability vocabulary - %s', (decision) => {
    expect(isCapability(capabilityFor(decision))).toBe(true);
  });
});

describe('REVIEW_STATUS_LABELS_HE', () => {
  it('labels the review states plus the published one', () => {
    expect(REVIEW_STATUS_LABELS_HE.in_review).toBe('בבדיקה');
    expect(REVIEW_STATUS_LABELS_HE.draft).toBe('טיוטה');
    expect(REVIEW_STATUS_LABELS_HE.changes_requested).toBe('הוחזרה לתיקון');
    expect(REVIEW_STATUS_LABELS_HE.rejected).toBe('נדחתה');
    expect(REVIEW_STATUS_LABELS_HE.active).toBe('אושרה ופורסמה');
  });

  it('labels every review status', () => {
    for (const status of REVIEW_VOTE_STATUSES) {
      expect(REVIEW_STATUS_LABELS_HE[status]).not.toMatch(/[A-Za-z]/);
    }
  });
});
