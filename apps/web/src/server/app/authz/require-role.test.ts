/**
 * THE server-side authorization helper (RBAC-02).
 *
 * Two properties here are worth more than the rest combined:
 *
 *   1. A database error propagates as DB, never as FORBIDDEN. If it collapsed
 *      into a 403, an outage would read to every caller as "you lost your
 *      permissions" - and to an operator as a security incident.
 *   2. A space_admin cannot act outside its space or on an admin-tier grant,
 *      so two space admins cannot neutralize each other.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { errAsync, okAsync } from 'neverthrow';
import type { RoleGrant } from '@/lib/supabase/types';
import { dbError } from '@/server/http/errors';
import { findLiveGrant, listActiveGrants } from '@/server/infra/supabase/role.repo';
import { requireRole, requireReviewAuthority, requireAdminScope } from './require-role';

vi.mock('@/server/infra/supabase/role.repo', async () => {
  const { okAsync: ok } = await import('neverthrow');
  return {
    findLiveGrant: vi.fn(() => ok(null)),
    listActiveGrants: vi.fn(() => ok([])),
  };
});

const USER = '11111111-1111-4111-8111-111111111111';
const SPACE = 'תל אביב-יפו';
const OTHER_SPACE = 'חיפה';

function row(overrides: Partial<RoleGrant> = {}): RoleGrant {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: USER,
    role: 'community_manager',
    space_id: SPACE,
    status: 'active',
    source: 'application',
    source_id: null,
    granted_by: null,
    granted_at: '2026-08-01T00:00:00.000Z',
    ended_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as RoleGrant;
}

beforeEach(() => {
  vi.mocked(findLiveGrant).mockReset().mockReturnValue(okAsync(null));
  vi.mocked(listActiveGrants).mockReset().mockReturnValue(okAsync([]));
});

describe('requireRole', () => {
  it('denies when no grant exists', async () => {
    const result = await requireRole(USER, 'community_manager', SPACE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ kind: 'FORBIDDEN', reason: 'no_grant' });
  });

  it('denies a suspended grant', async () => {
    vi.mocked(findLiveGrant).mockReturnValue(okAsync(row({ status: 'suspended' })));

    const result = await requireRole(USER, 'community_manager', SPACE);

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'FORBIDDEN',
      reason: 'grant_suspended',
    });
  });

  it('allows an active grant', async () => {
    vi.mocked(findLiveGrant).mockReturnValue(okAsync(row()));

    const result = await requireRole(USER, 'community_manager', SPACE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      role: 'community_manager',
      spaceId: SPACE,
      status: 'active',
    });
  });

  it('propagates a database error as DB, never as FORBIDDEN', async () => {
    // An outage must surface as 500. Collapsing it to 403 would tell every
    // caller they lost their permissions.
    vi.mocked(findLiveGrant).mockReturnValue(errAsync(dbError('role_grants.findLiveGrant')));

    const result = await requireRole(USER, 'community_manager', SPACE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('DB');
  });
});

describe('requireReviewAuthority', () => {
  it('admits a platform super_admin', async () => {
    vi.mocked(findLiveGrant).mockImplementation((_u, role) =>
      role === 'super_admin'
        ? okAsync(row({ role: 'super_admin', space_id: null }))
        : okAsync(null)
    );

    const result = await requireReviewAuthority(USER, {
      spaceId: SPACE,
      targetRole: 'community_manager',
      action: 'approve',
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().actorRole).toBe('super_admin');
  });

  it('admits a space_admin inside its own space', async () => {
    vi.mocked(findLiveGrant).mockImplementation((_u, role, spaceId) =>
      role === 'space_admin' && spaceId === SPACE
        ? okAsync(row({ role: 'space_admin', space_id: SPACE }))
        : okAsync(null)
    );

    const result = await requireReviewAuthority(USER, {
      spaceId: SPACE,
      targetRole: 'community_manager',
      action: 'suspend',
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().actorRole).toBe('space_admin');
  });

  it('denies a space_admin acting in a different space', async () => {
    vi.mocked(findLiveGrant).mockImplementation((_u, role, spaceId) =>
      role === 'space_admin' && spaceId === SPACE
        ? okAsync(row({ role: 'space_admin', space_id: SPACE }))
        : okAsync(null)
    );

    const result = await requireReviewAuthority(USER, {
      spaceId: OTHER_SPACE,
      targetRole: 'community_manager',
      action: 'approve',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('FORBIDDEN');
  });

  it('denies a space_admin acting on an admin-tier grant', async () => {
    vi.mocked(findLiveGrant).mockImplementation((_u, role, spaceId) =>
      role === 'space_admin' && spaceId === SPACE
        ? okAsync(row({ role: 'space_admin', space_id: SPACE }))
        : okAsync(null)
    );

    const result = await requireReviewAuthority(USER, {
      spaceId: SPACE,
      targetRole: 'space_admin',
      action: 'revoke',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'FORBIDDEN',
      reason: 'insufficient_scope',
    });
  });

  it('propagates a database error instead of falling through to space_admin', async () => {
    vi.mocked(findLiveGrant).mockReturnValue(errAsync(dbError('role_grants.findLiveGrant')));

    const result = await requireReviewAuthority(USER, {
      spaceId: SPACE,
      targetRole: null,
      action: 'approve',
    });

    expect(result._unsafeUnwrapErr().kind).toBe('DB');
  });
});

describe('requireAdminScope', () => {
  it('returns platform scope for a super_admin', async () => {
    vi.mocked(listActiveGrants).mockReturnValue(
      okAsync([row({ role: 'super_admin', space_id: null })])
    );

    const result = await requireAdminScope(USER);

    expect(result._unsafeUnwrap()).toEqual({ kind: 'platform' });
  });

  it('returns every space a space_admin administers', async () => {
    vi.mocked(listActiveGrants).mockReturnValue(
      okAsync([
        row({ role: 'space_admin', space_id: SPACE }),
        row({ role: 'space_admin', space_id: OTHER_SPACE }),
      ])
    );

    const result = await requireAdminScope(USER);

    expect(result._unsafeUnwrap()).toEqual({
      kind: 'spaces',
      spaceIds: [SPACE, OTHER_SPACE],
    });
  });

  it('denies an actor with no admin grant', async () => {
    vi.mocked(listActiveGrants).mockReturnValue(okAsync([row()]));

    const result = await requireAdminScope(USER);

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'FORBIDDEN',
      reason: 'no_admin_grant',
    });
  });
});
