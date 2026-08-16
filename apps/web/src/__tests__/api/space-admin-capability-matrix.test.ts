/**
 * Default-deny capability resolution - SPACE-02.
 *
 * Holding one capability must open exactly the endpoints that require it and
 * no others. The branded `SpaceScope` stops a caller-supplied space id reaching
 * the data layer; it does *not* stop a scope minted for one capability being
 * handed to a repository belonging to another. That correctness lives in each
 * use-case's `authorize(…, capability)` call, and this table is what proves it.
 *
 * The second property here is negative: `granted_via_role` is provenance for
 * the UI preset picker and is never authority. A row stamped `space_admin` that
 * grants `metrics.read` grants metrics.read, full stop.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import { CAPABILITIES, type Capability } from '@/server/domain/space/capability';
import {
  MUNICIPALITY_A,
  SESSION,
  SPACE_A,
  grantRow,
  proposalRow,
  spaceRow,
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

/**
 * The overview now reads three tables through three repositories, one per
 * figure. Each is mocked here, because a matrix row that holds `member.read`
 * or `notification.send` reaches the real module otherwise.
 */
vi.mock('@/server/infra/supabase/space-member.repo', () => ({
  countSpaceMembers: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space-notify.repo', () => ({
  countCampaignsSentThisMonth: vi.fn(),
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
import { countSpaceMembers } from '@/server/infra/supabase/space-member.repo';
import { countCampaignsSentThisMonth } from '@/server/infra/supabase/space-notify.repo';
import { GET as GET_OVERVIEW } from '@/app/api/space-admin/[spaceId]/route';
import { GET as GET_PROPOSALS } from '@/app/api/space-admin/[spaceId]/proposals/route';

const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

const ENDPOINTS = {
  overview: () =>
    GET_OVERVIEW(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}`),
      ctx(SPACE_A)
    ),
  proposals: () =>
    GET_PROPOSALS(
      new NextRequest(`http://localhost/api/space-admin/${SPACE_A}/proposals`),
      ctx(SPACE_A)
    ),
} as const;

type EndpointName = keyof typeof ENDPOINTS;

/** The caller holds exactly this one capability in space A and nothing anywhere else. */
function holdsExactly(
  capability: Capability,
  overrides: Parameters<typeof grantRow>[1] = {}
) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, wanted) =>
    okAsync(
      spaceId === SPACE_A && wanted === capability
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
  (findGrantsForUser as Mock).mockImplementation((_userId, spaceId) =>
    okAsync(spaceId === SPACE_A ? [grantRow(capability, overrides)] : [])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (findSpaceSummaryByMembership as Mock).mockReturnValue(okAsync(spaceRow()));
  (countProposalsAwaitingDecision as Mock).mockReturnValue(okAsync(3));
  (countActiveVotes as Mock).mockReturnValue(okAsync(2));
  (listProposals as Mock).mockReturnValue(okAsync([proposalRow()]));
  (countSpaceMembers as Mock).mockReturnValue(okAsync(7));
  (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(1));
});

/**
 * Overview is reachable on *membership* - any single grant - because there is
 * deliberately no twelfth `space.read` capability. The proposal queue needs
 * `proposal.read` and nothing else will do.
 */
const MATRIX: Array<[Capability, EndpointName, number]> = CAPABILITIES.flatMap(
  (capability): Array<[Capability, EndpointName, number]> => [
    [capability, 'overview', 200],
    [capability, 'proposals', capability === 'proposal.read' ? 200 : 403],
  ]
);

describe('capability matrix', () => {
  it('covers every capability against every endpoint shipped so far', () => {
    expect(MATRIX).toHaveLength(CAPABILITIES.length * 2);
    expect(MATRIX.filter(([, endpoint]) => endpoint === 'proposals')).toHaveLength(11);
    expect(MATRIX.filter(([, , status]) => status === 403)).toHaveLength(10);
  });

  it.each(MATRIX)('holding %s alone ⇒ %s responds %i', async (capability, endpoint, expected) => {
    holdsExactly(capability);
    const res = await ENDPOINTS[endpoint]();
    expect(res.status).toBe(expected);
  });

  it.each(MATRIX.filter(([, , status]) => status === 403))(
    'the denial for %s on %s discloses nothing',
    async (capability, endpoint) => {
      holdsExactly(capability);
      const res = await ENDPOINTS[endpoint]();
      expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
  );
});

describe('granted_via_role is provenance, never authority', () => {
  it('refuses the proposals endpoint to a metrics.read row stamped space_admin', async () => {
    holdsExactly('metrics.read', { granted_via_role: 'space_admin' });

    const res = await ENDPOINTS.proposals();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(listProposals).not.toHaveBeenCalled();
    // The resolver is asked for the capability, not for the role.
    expect(findActiveGrant).toHaveBeenCalledWith(
      SESSION.userId,
      SPACE_A,
      'proposal.read'
    );
  });

  it('still opens the metrics-holder’s shell, with the proposal figures absent', async () => {
    holdsExactly('metrics.read', { granted_via_role: 'space_admin' });

    const res = await ENDPOINTS.overview();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.capabilities).toEqual(['metrics.read']);
    // Absent, not zero: a fabricated 0 is indistinguishable from a measured one.
    expect(body.figures.proposalsAwaitingDecision).toBeNull();
    expect(body.recentQueue).toBeNull();
  });
});

describe('the overview only bills a figure to a caller who may see it', () => {
  it('fills the proposal figures for a proposal.read holder', async () => {
    holdsExactly('proposal.read');

    const body = await (await ENDPOINTS.overview()).json();

    // Both vote figures ride on the one scope: they read the same table under
    // the same predicate, so they cannot have two different answers.
    expect(body.figures.proposalsAwaitingDecision).toBe(3);
    expect(body.figures.activeVotes).toBe(2);
    expect(body.recentQueue).toHaveLength(1);
  });

  it('withholds the figures that belong to capabilities the caller lacks', async () => {
    holdsExactly('proposal.read');

    const body = await (await ENDPOINTS.overview()).json();

    // Absent, not zero - and the repositories behind them are never called.
    expect(body.figures.membersInSpace).toBeNull();
    expect(body.figures.notificationsSentThisMonth).toBeNull();
    expect(countSpaceMembers).not.toHaveBeenCalled();
    expect(countCampaignsSentThisMonth).not.toHaveBeenCalled();
  });

  it('fills the member figure for a member.read holder, and only that one', async () => {
    holdsExactly('member.read');

    const body = await (await ENDPOINTS.overview()).json();

    expect(body.figures.membersInSpace).toBe(7);
    expect(body.figures.proposalsAwaitingDecision).toBeNull();
    expect(body.figures.activeVotes).toBeNull();
    expect(body.figures.notificationsSentThisMonth).toBeNull();
    expect(body.recentQueue).toBeNull();
  });

  it('fills the notification figure for a notification.send holder, and only that one', async () => {
    holdsExactly('notification.send');

    const body = await (await ENDPOINTS.overview()).json();

    expect(body.figures.notificationsSentThisMonth).toBe(1);
    expect(body.figures.membersInSpace).toBeNull();
    expect(body.figures.proposalsAwaitingDecision).toBeNull();
    expect(body.figures.activeVotes).toBeNull();
  });
});
