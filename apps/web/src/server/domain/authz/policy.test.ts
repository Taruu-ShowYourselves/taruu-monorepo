/**
 * Pure authorization decisions (RBAC-02).
 *
 * The load-bearing test in this file is the `billingActive: false` denial. It
 * proves ROADMAP criterion 4: an approved applicant with no billing has no
 * manager access before any billing code exists, and it is what stops Phase 6
 * from having to redesign the authorization model to add its prerequisite.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateAuthorization,
  canReview,
  AUTHZ_REQUIREMENTS,
  type GrantFacts,
} from './policy';

const SPACE = 'תל אביב-יפו';
const OTHER_SPACE = 'חיפה';

function grant(overrides: Partial<GrantFacts> = {}): GrantFacts {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'community_manager',
    spaceId: SPACE,
    status: 'active',
    ...overrides,
  };
}

describe('evaluateAuthorization', () => {
  it('denies when there is no grant at all', () => {
    expect(evaluateAuthorization({ grant: null, billingActive: true })).toEqual({
      allowed: false,
      reason: 'no_grant',
    });
  });

  it('denies a suspended grant', () => {
    expect(
      evaluateAuthorization({ grant: grant({ status: 'suspended' }), billingActive: true })
    ).toEqual({ allowed: false, reason: 'grant_suspended' });
  });

  it('denies a revoked grant', () => {
    expect(
      evaluateAuthorization({ grant: grant({ status: 'revoked' }), billingActive: true })
    ).toEqual({ allowed: false, reason: 'grant_revoked' });
  });

  it('denies an ACTIVE grant when billing is inactive', () => {
    // ROADMAP criterion 4. Approval is a prerequisite that by itself grants
    // nothing: this caller is fully approved and still denied.
    expect(
      evaluateAuthorization({ grant: grant({ status: 'active' }), billingActive: false })
    ).toEqual({ allowed: false, reason: 'billing_inactive' });
  });

  it('allows an active grant with every requirement satisfied', () => {
    const g = grant();
    expect(evaluateAuthorization({ grant: g, billingActive: true })).toEqual({
      allowed: true,
      grant: g,
    });
  });

  it('composes requirements as a list Phase 6 can append to', () => {
    // If this count changes, a requirement was added or removed, which is
    // fine, but it must be a deliberate edit, not a silent one.
    expect(AUTHZ_REQUIREMENTS).toHaveLength(4);
  });
});

describe('canReview: super_admin', () => {
  const superAdmin = grant({ role: 'super_admin', spaceId: null });

  it('may act in any space, on any target role, for every action', () => {
    for (const action of ['approve', 'reject', 'suspend', 'reinstate', 'revoke'] as const) {
      for (const targetRole of [null, 'community_manager', 'space_admin', 'super_admin'] as const) {
        expect(
          canReview(
            { actorGrants: [superAdmin], targetSpaceId: OTHER_SPACE, targetRole },
            action
          )
        ).toBe(true);
      }
    }
  });
});

describe('canReview: space_admin', () => {
  const spaceAdmin = grant({ role: 'space_admin', spaceId: SPACE });

  it('may act inside its own space on an application (targetRole null)', () => {
    expect(
      canReview(
        { actorGrants: [spaceAdmin], targetSpaceId: SPACE, targetRole: null },
        'approve'
      )
    ).toBe(true);
  });

  it('may suspend a community_manager inside its own space', () => {
    // Resolves Open Question 1: an admin who can approve but cannot undo their
    // own decision is operationally indefensible.
    expect(
      canReview(
        { actorGrants: [spaceAdmin], targetSpaceId: SPACE, targetRole: 'community_manager' },
        'suspend'
      )
    ).toBe(true);
  });

  it('may NOT act in another space', () => {
    expect(
      canReview(
        { actorGrants: [spaceAdmin], targetSpaceId: OTHER_SPACE, targetRole: 'community_manager' },
        'approve'
      )
    ).toBe(false);
  });

  it('may NOT act on a space_admin grant; admins cannot neutralize each other', () => {
    expect(
      canReview(
        { actorGrants: [spaceAdmin], targetSpaceId: SPACE, targetRole: 'space_admin' },
        'revoke'
      )
    ).toBe(false);
  });

  it('may NOT act on a super_admin grant', () => {
    expect(
      canReview(
        { actorGrants: [spaceAdmin], targetSpaceId: SPACE, targetRole: 'super_admin' },
        'revoke'
      )
    ).toBe(false);
  });

  it('is denied when its own grant is suspended', () => {
    expect(
      canReview(
        {
          actorGrants: [grant({ role: 'space_admin', spaceId: SPACE, status: 'suspended' })],
          targetSpaceId: SPACE,
          targetRole: 'community_manager',
        },
        'approve'
      )
    ).toBe(false);
  });
});

describe('canReview: no authority', () => {
  it('denies an actor holding no grants', () => {
    expect(
      canReview({ actorGrants: [], targetSpaceId: SPACE, targetRole: null }, 'approve')
    ).toBe(false);
  });

  it('denies a community_manager trying to review', () => {
    expect(
      canReview(
        { actorGrants: [grant()], targetSpaceId: SPACE, targetRole: null },
        'approve'
      )
    ).toBe(false);
  });
});
