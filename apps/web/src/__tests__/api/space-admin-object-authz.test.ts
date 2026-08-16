/**
 * Object-level authorization - SPACE-03, the phase's headline criterion.
 *
 * A space admin who swaps `spaceId` in the URL must get the *same* opaque 403
 * they would get for a space that does not exist, for a malformed id, and for a
 * space whose grant has been suspended. Anything that distinguishes those cases
 * is a space-enumeration oracle.
 *
 * RLS secures none of this: every query runs as the Supabase service role,
 * which has BYPASSRLS. The guarantee is the branded `SpaceScope` plus the
 * predicate this file proves is in the SQL.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import {
  MUNICIPALITY_A,
  SESSION,
  SPACE_A,
  SPACE_B,
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
const fromSpy = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      fromSpy(table);
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
import { GET as GET_OVERVIEW } from '@/app/api/space-admin/[spaceId]/route';
import { GET as GET_PROPOSALS } from '@/app/api/space-admin/[spaceId]/proposals/route';

const FORBIDDEN_BODY = { error: 'Forbidden', code: 'FORBIDDEN' };

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

/** The caller holds every listed capability in space A and nothing in space B. */
function grantOnlyInSpaceA(capabilities: string[]) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
  (findGrantsForUser as Mock).mockImplementation((_userId, spaceId) =>
    okAsync(spaceId === SPACE_A ? capabilities.map((c) => grantRow(c as never)) : [])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lastBuilder = null;
  queryResult = { data: [], error: null };
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  grantOnlyInSpaceA(['proposal.read', 'metrics.read']);
  (findSpaceSummaryByMembership as Mock).mockReturnValue(okAsync(spaceRow()));
  (countProposalsAwaitingDecision as Mock).mockReturnValue(okAsync(3));
  (countActiveVotes as Mock).mockReturnValue(okAsync(2));
  (listProposals as Mock).mockReturnValue(okAsync([proposalRow()]));
});

describe('GET /api/space-admin/[spaceId] - overview', () => {
  it('returns 200 for the space the caller actually administers', async () => {
    const res = await GET_OVERVIEW(req(`/api/space-admin/${SPACE_A}`), ctx(SPACE_A));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.space.id).toBe(SPACE_A);
    expect(body.capabilities).toEqual(['proposal.read', 'metrics.read']);
  });

  it('returns an identical opaque 403 for a space the caller does not administer', async () => {
    const res = await GET_OVERVIEW(req(`/api/space-admin/${SPACE_B}`), ctx(SPACE_B));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(JSON.stringify(body)).not.toContain(SPACE_B);
    expect(JSON.stringify(body).toLowerCase()).not.toContain('not found');
  });

  it('rejects an unauthenticated request with 401 before any authorization work', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);
    const res = await GET_OVERVIEW(req(`/api/space-admin/${SPACE_A}`), ctx(SPACE_A));
    expect(res.status).toBe(401);
    expect(findGrantsForUser).not.toHaveBeenCalled();
  });
});

describe('GET /api/space-admin/[spaceId]/proposals', () => {
  it('returns 200 and the queue when the caller holds proposal.read', async () => {
    const res = await GET_PROPOSALS(
      req(`/api/space-admin/${SPACE_A}/proposals`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].selfSubmitted).toBe(false);
  });

  it('returns the identical opaque 403 for another space', async () => {
    const res = await GET_PROPOSALS(
      req(`/api/space-admin/${SPACE_B}/proposals`),
      ctx(SPACE_B)
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(JSON.stringify(body)).not.toContain(SPACE_B);
    expect(listProposals).not.toHaveBeenCalled();
  });

  it('marks the viewer’s own submission so the UI can lock the decision', async () => {
    (listProposals as Mock).mockReturnValue(
      okAsync([proposalRow({ creator_id: SESSION.userId })])
    );
    const res = await GET_PROPOSALS(
      req(`/api/space-admin/${SPACE_A}/proposals`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    expect(body.proposals[0].selfSubmitted).toBe(true);
  });
});

describe('a malformed space id is a denial, never a 400 or a 404', () => {
  it.each([
    ['overview', GET_OVERVIEW],
    ['proposals', GET_PROPOSALS],
  ])('%s short-circuits before touching the database', async (_name, handler) => {
    const res = await handler(req('/api/space-admin/not-a-uuid'), ctx('not-a-uuid'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN_BODY);
    expect(findActiveGrant).not.toHaveBeenCalled();
    expect(findGrantsForUser).not.toHaveBeenCalled();
  });

  it('is byte-for-byte the same response as an unauthorized real space', async () => {
    const malformed = await GET_PROPOSALS(
      req('/api/space-admin/not-a-uuid/proposals'),
      ctx('not-a-uuid')
    );
    const unauthorized = await GET_PROPOSALS(
      req(`/api/space-admin/${SPACE_B}/proposals`),
      ctx(SPACE_B)
    );
    expect(malformed.status).toBe(unauthorized.status);
    expect(await malformed.text()).toBe(await unauthorized.text());
  });
});

describe('the space predicate is in the SQL, not applied after the fetch', () => {
  it('scopes listProposals on municipality_id from the scope', async () => {
    const real = await vi.importActual<typeof import('@/server/infra/supabase/space.repo')>(
      '@/server/infra/supabase/space.repo'
    );
    queryResult = { data: [], error: null };

    await real.listProposals(scopeFor('proposal.read'), {});

    expect(fromSpy).toHaveBeenCalledWith('votes');
    const eq = lastBuilder?.spies.eq;
    expect(eq).toHaveBeenCalledWith('municipality_id', MUNICIPALITY_A);
    const filteredColumns = (eq?.mock.calls ?? []).map(([column]) => column);
    expect(filteredColumns).toEqual(['municipality_id']);
  });

  it('resolves a grant only while suspended_at is null', async () => {
    const real = await vi.importActual<typeof import('@/server/infra/supabase/space.repo')>(
      '@/server/infra/supabase/space.repo'
    );
    queryResult = { data: null, error: null };

    await real.findActiveGrant(SESSION.userId, SPACE_A, 'proposal.read');

    expect(fromSpy).toHaveBeenCalledWith('space_capability_grants');
    expect(lastBuilder?.spies.is).toHaveBeenCalledWith('suspended_at', null);
  });
});
