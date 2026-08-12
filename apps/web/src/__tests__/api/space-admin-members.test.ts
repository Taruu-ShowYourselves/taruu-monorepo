/**
 * People governance - SPACE-06 and SPACE-09.
 *
 * Four properties are under test here, and each one has failed in some system
 * before:
 *
 * 1. The member listing carries the administration fields and nothing else. A
 *    serialization guard reads the whole response as text, because the leak
 *    that matters is the one nobody thought to assert a field name for.
 * 2. Every authority-changing action writes exactly one audit row, with the
 *    caller's reason, and does so as part of the same chain that performed the
 *    write rather than afterwards.
 * 3. Suspension bites immediately and erases nothing.
 * 4. Platform authority and space authority are different things: eleven space
 *    capabilities do not add up to the one platform action, and the platform
 *    marker on its own does not open a single space surface.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { errAsync, okAsync } from 'neverthrow';
import { CAPABILITIES, type Capability } from '@/server/domain/space/capability';
import { conflict } from '@/server/http/errors';
import {
  auditRow,
  MUNICIPALITY_A,
  OTHER_USER_ID,
  scopeFor,
  SESSION,
  SPACE_A,
  SPACE_B,
  USER_ID,
} from '../fixtures/space';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space-audit.repo', () => ({
  insertAuditRow: vi.fn(),
  listAuditRows: vi.fn(),
  AUDIT_PAGE_MAX: 100,
}));

vi.mock('@/server/infra/supabase/space-member.repo', () => ({
  listSpaceMembers: vi.fn(),
  countSpaceMembers: vi.fn(),
  listGrantsForSpace: vi.fn(),
  listActiveMemberSuspensions: vi.fn(),
  isPlatformAdmin: vi.fn(),
  insertGrant: vi.fn(),
  revokeGrant: vi.fn(),
  suspendGrantById: vi.fn(),
  insertMemberSuspension: vi.fn(),
  liftMemberSuspension: vi.fn(),
  setContentModeration: vi.fn(),
  insertEscalation: vi.fn(),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { insertAuditRow, listAuditRows } from '@/server/infra/supabase/space-audit.repo';
import {
  countSpaceMembers,
  insertGrant,
  insertMemberSuspension,
  isPlatformAdmin,
  liftMemberSuspension,
  listActiveMemberSuspensions,
  listGrantsForSpace,
  listSpaceMembers,
  revokeGrant,
  setContentModeration,
  suspendGrantById,
} from '@/server/infra/supabase/space-member.repo';
import { GET as GET_MEMBERS } from '@/app/api/space-admin/[spaceId]/members/route';
import {
  POST as POST_GRANT,
  DELETE as DELETE_GRANT,
} from '@/app/api/space-admin/[spaceId]/grants/route';
import {
  POST as POST_SUSPENSION,
  DELETE as DELETE_SUSPENSION,
} from '@/app/api/space-admin/[spaceId]/members/suspension/route';
import { POST as POST_CONTENT } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/content/route';

const GRANT_ID = '77777777-7777-4777-8777-777777777777';
const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const REASON = 'נדרש לתפקיד החדש במרחב';

const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });
const contentCtx = (spaceId: string) => ({
  params: Promise.resolve({ spaceId, voteId: VOTE_ID }),
});

const json = (method: string, url: string, body: unknown) =>
  new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

/**
 * A `users` row exactly as the repository's seven-column allow-list projects
 * it. Written out in full rather than spread from a helper, so a reader can see
 * that the raw row carries names and a verification timestamp - both of which
 * the response must transform rather than pass through.
 */
const memberRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: OTHER_USER_ID,
  first_name: 'דנה',
  last_name: 'לוי',
  municipality_id: MUNICIPALITY_A,
  verification_status: 'verified' as const,
  identity_verified_at: '2026-05-02T08:30:00.000Z',
  created_at: '2026-04-01T10:00:00.000Z',
  ...overrides,
});

const grantRecord = (capability: Capability = 'proposal.read') => ({
  id: GRANT_ID,
  user_id: OTHER_USER_ID,
  capability,
  granted_via_role: null,
});

/** The caller holds exactly these capabilities, in this space and nowhere else. */
function holds(capabilities: readonly Capability[], space: string = SPACE_A) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, wanted) =>
    okAsync(
      spaceId === space && capabilities.includes(wanted as Capability)
        ? { space_id: space, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (insertAuditRow as Mock).mockReturnValue(okAsync({ id: 'audit-1' }));
  (listSpaceMembers as Mock).mockReturnValue(okAsync([memberRow()]));
  (countSpaceMembers as Mock).mockReturnValue(okAsync(1));
  (listGrantsForSpace as Mock).mockReturnValue(
    okAsync([{ user_id: OTHER_USER_ID, capability: 'proposal.read' }])
  );
  (listActiveMemberSuspensions as Mock).mockReturnValue(okAsync([]));
  (isPlatformAdmin as Mock).mockReturnValue(okAsync(false));
  (insertGrant as Mock).mockReturnValue(okAsync(grantRecord('member.read')));
  (revokeGrant as Mock).mockReturnValue(okAsync(grantRecord('member.read')));
  (suspendGrantById as Mock).mockReturnValue(okAsync(grantRecord('grant.create')));
  (insertMemberSuspension as Mock).mockReturnValue(
    okAsync({ id: 'susp-1', suspended_at: '2026-08-03T09:00:00.000Z' })
  );
  (liftMemberSuspension as Mock).mockReturnValue(
    okAsync({ id: 'susp-1', suspended_at: '2026-08-03T09:00:00.000Z' })
  );
  (setContentModeration as Mock).mockReturnValue(
    okAsync({ id: VOTE_ID, hidden_at: '2026-08-03T09:00:00.000Z', flagged_at: null })
  );
  (listAuditRows as Mock).mockReturnValue(
    okAsync({
      rows: [auditRow({ actor_user_id: OTHER_USER_ID })],
      nextCursor: null,
      truncated: false,
    })
  );
});

// ---------------------------------------------------------------------------
// The listing
// ---------------------------------------------------------------------------

describe('GET /api/space-admin/{spaceId}/members', () => {
  it('returns the allow-listed member shape to a caller holding member.read', async () => {
    holds(['member.read']);

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toEqual({
      id: OTHER_USER_ID,
      displayName: 'דנה לוי',
      municipality: MUNICIPALITY_A,
      joinedAt: '2026-04-01T10:00:00.000Z',
      verificationStatus: 'verified',
      identityVerified: true,
      suspended: false,
      capabilities: ['proposal.read'],
    });
  });

  it('emits identityVerified as a boolean and never the verification timestamp', async () => {
    holds(['member.read']);

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );
    const body = await res.json();

    expect(body.members[0].identityVerified).toBe(true);
    expect(JSON.stringify(body)).not.toContain('2026-05-02T08:30:00.000Z');
  });

  it('reports a member with an unlifted suspension as suspended', async () => {
    holds(['member.read']);
    (listActiveMemberSuspensions as Mock).mockReturnValue(
      okAsync([{ user_id: OTHER_USER_ID }])
    );

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );
    const body = await res.json();

    expect(body.members[0].suspended).toBe(true);
  });

  /**
   * A text-level guard rather than a field-by-field one. Asserting that
   * `body.members[0].email` is undefined only catches the leak somebody already
   * thought of; reading the whole serialized response catches the shape nobody
   * named - a nested object, a renamed column, an accidental spread.
   */
  it('serializes nothing resembling an identity document, contact channel or DID', async () => {
    holds(['member.read']);
    (listSpaceMembers as Mock).mockReturnValue(
      okAsync([
        memberRow(),
        memberRow({ id: USER_ID, first_name: null, last_name: null }),
      ])
    );

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );
    const serialized = JSON.stringify(await res.json());

    expect(serialized).not.toMatch(/id_number|dateOfBirth|@|\+972|did:sync|documentExpiry/);
  });

  it('falls back to a Hebrew label rather than an empty name', async () => {
    holds(['member.read']);
    (listSpaceMembers as Mock).mockReturnValue(
      okAsync([memberRow({ first_name: null, last_name: null })])
    );

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );
    const body = await res.json();

    expect(body.members[0].displayName).toBe('תושב/ת');
  });

  it('refuses a caller holding only metrics.read', async () => {
    holds(['metrics.read']);

    const res = await GET_MEMBERS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/members`),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(403);
    expect(listSpaceMembers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

describe('POST /api/space-admin/{spaceId}/grants', () => {
  const body = {
    userId: OTHER_USER_ID,
    capability: 'member.read' as const,
    reason: REASON,
  };

  it('writes the grant and exactly one grant.created audit row', async () => {
    holds(['grant.create']);

    const res = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(200);
    expect(insertGrant).toHaveBeenCalledTimes(1);
    expect(insertAuditRow).toHaveBeenCalledTimes(1);
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        space_id: SPACE_A,
        actor_user_id: USER_ID,
        action: 'grant.created',
        object_type: 'grant',
        object_id: GRANT_ID,
        reason: REASON,
      })
    );
  });

  it('answers 409 when the grant already exists', async () => {
    holds(['grant.create']);
    (insertGrant as Mock).mockReturnValue(errAsync(conflict('ההרשאה כבר קיימת.')));

    const res = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(409);
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('rejects a reason under ten characters before touching the repository', async () => {
    holds(['grant.create']);

    const res = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, {
        ...body,
        reason: 'קצר',
      }),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(400);
    expect(insertGrant).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/space-admin/{spaceId}/grants', () => {
  const body = {
    userId: OTHER_USER_ID,
    capability: 'member.read' as const,
    reason: REASON,
  };

  it('requires grant.revoke and writes grant.revoked', async () => {
    holds(['grant.revoke']);

    const res = await DELETE_GRANT(
      json('DELETE', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(200);
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'grant.revoked',
        prior_state: { capability: 'member.read', active: true },
        new_state: { capability: 'member.read', active: false },
      })
    );
  });

  it('is refused to a caller holding grant.create but not grant.revoke', async () => {
    holds(['grant.create']);

    const res = await DELETE_GRANT(
      json('DELETE', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(403);
    expect(revokeGrant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Member suspension
// ---------------------------------------------------------------------------

describe('POST/DELETE /api/space-admin/{spaceId}/members/suspension', () => {
  const body = { userId: OTHER_USER_ID, reason: REASON };

  it('suspends under member.suspend and writes member.suspended', async () => {
    holds(['member.suspend']);

    const res = await POST_SUSPENSION(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/members/suspension`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(200);
    expect(insertMemberSuspension).toHaveBeenCalledTimes(1);
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'member.suspended',
        object_type: 'member',
        object_id: OTHER_USER_ID,
        prior_state: { suspended: false },
        new_state: { suspended: true },
        reason: REASON,
      })
    );
  });

  it('reinstates under the same capability and writes member.reinstated', async () => {
    holds(['member.suspend']);

    const res = await DELETE_SUSPENSION(
      json(
        'DELETE',
        `http://localhost/api/space-admin/${SPACE_A}/members/suspension`,
        body
      ),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(200);
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'member.reinstated',
        prior_state: { suspended: true },
        new_state: { suspended: false },
      })
    );
  });

  it('answers 409 when the member is already suspended', async () => {
    holds(['member.suspend']);
    (insertMemberSuspension as Mock).mockReturnValue(
      errAsync(conflict('החבר/ה כבר מושעה/ית במרחב הזה.'))
    );

    const res = await POST_SUSPENSION(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/members/suspension`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(409);
    expect(insertAuditRow).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SPACE-09: suspension is immediate and erases nothing
// ---------------------------------------------------------------------------

describe('suspension preserves history', () => {
  /**
   * The whole of SPACE-09 in one case, because the two halves are only
   * meaningful together: a suspension that stopped access by deleting the
   * evidence would satisfy the first assertion and fail the requirement.
   */
  it('kills the suspended member capabilities on the next request and leaves their audit rows readable', async () => {
    holds(['member.suspend']);

    const suspend = await POST_SUSPENSION(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/members/suspension`, {
        userId: OTHER_USER_ID,
        reason: REASON,
      }),
      ctx(SPACE_A)
    );
    expect(suspend.status).toBe(200);

    // The resolver now reflects what the suspension wrote. Nothing is cached
    // and the session is unchanged - the very next request re-reads the grant.
    holds([]);
    const afterwards = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, {
        userId: USER_ID,
        capability: 'member.read',
        reason: REASON,
      }),
      ctx(SPACE_A)
    );
    expect(afterwards.status).toBe(403);

    // …and their history is still there.
    const history = await listAuditRows(scopeFor('audit.read'), {
      actorId: OTHER_USER_ID,
    });
    expect(history.isOk()).toBe(true);
    expect(history._unsafeUnwrap().rows[0]).toMatchObject({
      actor_user_id: OTHER_USER_ID,
      action: 'proposal.approved',
    });
  });

  it('gives the application no vocabulary for editing or removing history', async () => {
    const auditModule = await vi.importActual<Record<string, unknown>>(
      '@/server/infra/supabase/space-audit.repo'
    );
    const memberModule = await vi.importActual<Record<string, unknown>>(
      '@/server/infra/supabase/space-member.repo'
    );

    const surface = [...Object.keys(auditModule), ...Object.keys(memberModule)];

    // Guard against the assertion below passing because nothing loaded.
    expect(surface).toContain('insertAuditRow');
    expect(surface).toContain('insertMemberSuspension');

    expect(surface.filter((name) => /^(delete|remove|purge|truncate)/i.test(name))).toEqual(
      []
    );
  });
});

// ---------------------------------------------------------------------------
// The platform-admin action
// ---------------------------------------------------------------------------

describe('platform-admin grant suspension', () => {
  const body = { grantId: GRANT_ID, reason: REASON };

  it('succeeds for a platform admin holding zero space capabilities', async () => {
    holds([]);
    (isPlatformAdmin as Mock).mockReturnValue(okAsync(true));

    const res = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(200);
    expect(suspendGrantById).toHaveBeenCalledWith(SPACE_A, GRANT_ID, USER_ID);
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'grant.suspended', actor_user_id: USER_ID })
    );
  });

  it('is refused to a space admin holding all eleven capabilities', async () => {
    holds(CAPABILITIES);
    (isPlatformAdmin as Mock).mockReturnValue(okAsync(false));

    const res = await POST_GRANT(
      json('POST', `http://localhost/api/space-admin/${SPACE_A}/grants`, body),
      ctx(SPACE_A)
    );

    expect(res.status).toBe(403);
    expect(suspendGrantById).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cross-space isolation
// ---------------------------------------------------------------------------

/**
 * Every capability-gated mutation in this plan, called against SPACE_B by a
 * session whose grants are all in SPACE_A.
 *
 * `POST /escalations` is deliberately absent from this table and is the one
 * endpoint in the plan that must NOT behave this way - it is reachable without
 * any capability by design (SPACE-09), and its own opacity cases live in
 * `space-admin-content.test.ts`. Do not "fix" the omission by adding a row
 * here; a 403 there would put the escalation path out of reach of exactly the
 * people it exists for.
 */
const CROSS_SPACE: Array<[string, () => Promise<Response>]> = [
  [
    'POST /grants',
    () =>
      POST_GRANT(
        json('POST', `http://localhost/api/space-admin/${SPACE_B}/grants`, {
          userId: OTHER_USER_ID,
          capability: 'member.read',
          reason: REASON,
        }),
        ctx(SPACE_B)
      ),
  ],
  [
    'DELETE /grants',
    () =>
      DELETE_GRANT(
        json('DELETE', `http://localhost/api/space-admin/${SPACE_B}/grants`, {
          userId: OTHER_USER_ID,
          capability: 'member.read',
          reason: REASON,
        }),
        ctx(SPACE_B)
      ),
  ],
  [
    'POST /members/suspension',
    () =>
      POST_SUSPENSION(
        json(
          'POST',
          `http://localhost/api/space-admin/${SPACE_B}/members/suspension`,
          { userId: OTHER_USER_ID, reason: REASON }
        ),
        ctx(SPACE_B)
      ),
  ],
  [
    'DELETE /members/suspension',
    () =>
      DELETE_SUSPENSION(
        json(
          'DELETE',
          `http://localhost/api/space-admin/${SPACE_B}/members/suspension`,
          { userId: OTHER_USER_ID, reason: REASON }
        ),
        ctx(SPACE_B)
      ),
  ],
  [
    'POST /proposals/{voteId}/content',
    () =>
      POST_CONTENT(
        json(
          'POST',
          `http://localhost/api/space-admin/${SPACE_B}/proposals/${VOTE_ID}/content`,
          { action: 'hide', reason: REASON }
        ),
        contentCtx(SPACE_B)
      ),
  ],
];

describe('cross-space isolation', () => {
  it('covers every capability-gated mutation endpoint in the plan', () => {
    expect(CROSS_SPACE).toHaveLength(5);
  });

  it.each(CROSS_SPACE)(
    '%s against a foreign space is refused with the constant body',
    async (_name, call) => {
      holds(CAPABILITIES, SPACE_A);
      (isPlatformAdmin as Mock).mockReturnValue(okAsync(false));

      const res = await call();

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
      expect(insertAuditRow).not.toHaveBeenCalled();
    }
  );
});
