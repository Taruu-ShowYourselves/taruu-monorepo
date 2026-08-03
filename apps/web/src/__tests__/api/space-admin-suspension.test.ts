/**
 * Suspension is immediate and never erases history — SPACE-09.
 *
 * Suspension is one nullable column, `space_capability_grants.suspended_at`.
 * Two properties follow and both are tested here:
 *
 *  1. Access dies on the *next* request. Every capability check resolves
 *     server-side from the database per request and nothing is cached; the JWT
 *     carries no roles claim, so there is no token to wait out and no re-login
 *     to force.
 *  2. The audit log is untouched. `space_audit_log` is append-only by trigger
 *     and REVOKE, with ON DELETE RESTRICT on both foreign keys, so a suspended
 *     admin's historical decisions stay readable.
 *
 * Suspension is simulated the way the database does it, not by clearing a mock:
 * `findActiveGrant` filters `suspended_at IS NULL` and so stops returning the
 * row, while `findGrantsForUser` — which reads suspended rows too, because a
 * suspended admin must still reach the shell — keeps returning it.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import {
  MUNICIPALITY_A,
  SESSION,
  SPACE_A,
  USER_ID,
  auditRow,
  grantRow,
  makeQueryBuilder,
  proposalRow,
  scopeFor,
  spaceRow,
  type QueryBuilderStub,
} from '../fixtures/space';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
  findSpaceSummary: vi.fn(),
  findSpaceSummaryByMembership: vi.fn(),
  listProposals: vi.fn(),
  countProposalsAwaitingDecision: vi.fn(),
  countActiveVotes: vi.fn(),
}));

let lastBuilder: QueryBuilderStub | null = null;
let queryResult: { data: unknown; error: unknown; count?: number | null } = {
  data: [],
  error: null,
};

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => {
      lastBuilder = makeQueryBuilder(queryResult);
      return lastBuilder.builder;
    },
  },
}));

import { getSessionFromRequest } from '@/services/auth/session';
import {
  countActiveVotes,
  countProposalsAwaitingDecision,
  findActiveGrant,
  findGrantsForUser,
  findSpaceSummaryByMembership,
  listProposals,
} from '@/server/infra/supabase/space.repo';
import { listAuditRows } from '@/server/infra/supabase/space-audit.repo';
import { GET as GET_OVERVIEW } from '@/app/api/space-admin/[spaceId]/route';
import { GET as GET_PROPOSALS } from '@/app/api/space-admin/[spaceId]/proposals/route';

const SUSPENDED_AT = '2026-08-02T12:00:00.000Z';
const HELD: Array<'proposal.read' | 'audit.read'> = ['proposal.read', 'audit.read'];

const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

const getProposals = () =>
  GET_PROPOSALS(
    new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/proposals`),
    ctx(SPACE_A)
  );

const getOverview = () =>
  GET_OVERVIEW(
    new NextRequest(`http://localhost/api/space-admin/${SPACE_A}`),
    ctx(SPACE_A)
  );

/**
 * `suspended` here means the column is set. `findActiveGrant` disappears the row
 * exactly as `.is('suspended_at', null)` does in SQL; `findGrantsForUser` does
 * not filter and still returns it.
 */
function setGrantState(suspended: boolean) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, wanted) =>
    okAsync(
      !suspended && spaceId === SPACE_A && (HELD as string[]).includes(wanted)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
  (findGrantsForUser as Mock).mockImplementation((_userId, spaceId) =>
    okAsync(
      spaceId === SPACE_A
        ? HELD.map((capability) =>
            grantRow(capability, { suspended_at: suspended ? SUSPENDED_AT : null })
          )
        : []
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lastBuilder = null;
  queryResult = { data: [], error: null };
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (findSpaceSummaryByMembership as Mock).mockReturnValue(okAsync(spaceRow()));
  (countProposalsAwaitingDecision as Mock).mockReturnValue(okAsync(3));
  (countActiveVotes as Mock).mockReturnValue(okAsync(2));
  (listProposals as Mock).mockReturnValue(okAsync([proposalRow()]));
  setGrantState(false);
});

describe('setting suspended_at kills access on the very next request', () => {
  it('flips 200 to an opaque 403 with the same session and no refresh', async () => {
    expect((await getProposals()).status).toBe(200);

    // The super admin sets suspended_at. Nothing else changes: same cookie,
    // same JWT, no logout, no refresh call.
    setGrantState(true);

    const denied = await getProposals();
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });

    // ...and the historical decisions the suspended admin made are still readable.
    queryResult = { data: [auditRow()], error: null };
    const history = await listAuditRows(scopeFor('audit.read'), { actorId: USER_ID });

    expect(history.isOk()).toBe(true);
    const page = history._unsafeUnwrap();
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].actor_user_id).toBe(USER_ID);
    expect(page.rows[0].action).toBe('proposal.approved');
    expect(lastBuilder?.spies.eq).toHaveBeenCalledWith('space_id', SPACE_A);
  });

  it('re-resolves the grant on every request, so there is no cache to wait out', async () => {
    await getProposals();
    expect(findActiveGrant).toHaveBeenCalledTimes(1);

    setGrantState(true);
    await getProposals();

    expect(findActiveGrant).toHaveBeenCalledTimes(2);
    expect(getSessionFromRequest).toHaveBeenCalledTimes(2);
  });
});

describe('a suspended admin still reaches the shell', () => {
  it('renders the space with suspended true and an empty capability manifest', async () => {
    setGrantState(true);

    const res = await getOverview();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.space.suspended).toBe(true);
    expect(body.capabilities).toEqual([]);
    // Every figure is absent, because no capability scope can be minted.
    expect(body.figures.proposalsAwaitingDecision).toBeNull();
    expect(body.recentQueue).toBeNull();
  });

  it('denies the shell outright to someone who never held a grant here', async () => {
    (findGrantsForUser as Mock).mockReturnValue(okAsync([]));

    const res = await getOverview();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    // No space identity leaks, so this is not distinguishable from suspension.
    expect(findSpaceSummaryByMembership).not.toHaveBeenCalled();
  });
});
