/**
 * Aggregate-only statistics — SPACE-07.
 *
 * The k-anonymity floor itself lives in SQL (migration 20260802000013): a
 * bucket of 1-4 is nulled before it leaves the database. This file does not
 * re-implement that rule in TypeScript and does not claim to test it. What it
 * tests is the API contract on top of it — that a suppressed figure, a genuine
 * zero and an uncomputable figure are three distinguishable things on the wire,
 * and that no shape in the response could ever carry a single resident.
 *
 * The suppression case deliberately stubs a *hostile* row — a true value beside
 * a `suppressed` status, which the shipped SQL never produces — because the
 * mapping's job is to be the second place the floor holds, not the first.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import { SpaceMetricsResponseSchema } from '@sync/shared/contracts';
import {
  MUNICIPALITY_A,
  SESSION,
  SPACE_A,
  SPACE_B,
  makeQueryBuilder,
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
}));

let lastBuilder: QueryBuilderStub | null = null;
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const rpcSpy = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: (fn: string, args: unknown) => {
      rpcSpy(fn, args);
      lastBuilder = makeQueryBuilder(rpcResult);
      return lastBuilder.builder;
    },
  },
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { GET as GET_METRICS } from '@/app/api/space-admin/[spaceId]/metrics/route';

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

const FORBIDDEN_BODY = { error: 'Forbidden', code: 'FORBIDDEN' };

/** A row exactly as the nine-column RPC projects it. */
function metricsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    registered_residents: 1200,
    registered_residents_status: 'available',
    active_participants_30d: 340,
    active_participants_30d_status: 'available',
    proposals_submitted: 12,
    proposals_submitted_status: 'available',
    participation_rate_pct: 28,
    participation_rate_pct_status: 'available',
    generated_at: '2026-08-03T09:00:00.000Z',
    ...overrides,
  };
}

/** The caller holds every listed capability in space A and nothing in space B. */
function grantOnlyInSpaceA(capabilities: string[]) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lastBuilder = null;
  rpcResult = { data: metricsRow(), error: null };
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  grantOnlyInSpaceA(['metrics.read']);
});

describe('GET /api/space-admin/[spaceId]/metrics', () => {
  it('returns the four figures to a caller holding metrics.read', async () => {
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registeredResidents).toEqual({ value: 1200, status: 'available' });
    expect(body.activeParticipants30d).toEqual({ value: 340, status: 'available' });
    expect(body.proposalsSubmitted).toEqual({ value: 12, status: 'available' });
    expect(body.participationRate).toEqual({ value: 28, status: 'available' });
    expect(body.generatedAt).toBe('2026-08-03T09:00:00.000Z');
  });

  it('reads the space id off the scope, never off the route parameter', async () => {
    await GET_METRICS(req(`/api/space-admin/${SPACE_A}/metrics`), ctx(SPACE_A));
    expect(rpcSpy).toHaveBeenCalledWith('space_admin_metrics', { space_uuid: SPACE_A });
    expect(lastBuilder?.spies.maybeSingle).toHaveBeenCalled();
  });

  it('suppresses a small bucket even if the row arrives carrying its true value', async () => {
    rpcResult = {
      data: metricsRow({
        registered_residents: 3,
        registered_residents_status: 'suppressed',
      }),
      error: null,
    };
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    expect(body.registeredResidents).toEqual({ value: null, status: 'suppressed' });
    expect(JSON.stringify(body)).not.toContain('3,');
  });

  it('passes a genuine zero through as a measured figure', async () => {
    rpcResult = {
      data: metricsRow({ proposals_submitted: 0, proposals_submitted_status: 'available' }),
      error: null,
    };
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    expect(body.proposalsSubmitted).toEqual({ value: 0, status: 'available' });
  });

  /**
   * Two things make the RPC return no row. One: the space row is deleted
   * between authorization and the query. Two: the SQL's
   * `WHERE EXISTS (SELECT 1 FROM s)` guard fires for a space whose
   * municipality_code is NULL. The second is not reachable through this route —
   * authorize() refuses to mint a scope without a municipality code, so such a
   * space is a 403 long before the RPC runs — but the guard is what stops the
   * SQL fabricating a `0 / available`, and this mapping is what stops a
   * mid-request delete becoming a 500. Neither is dead code.
   */
  it('maps a missing row to four unavailable figures and a 200, not a 500', async () => {
    rpcResult = { data: null, error: null };
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of [
      'registeredResidents',
      'activeParticipants30d',
      'proposalsSubmitted',
      'participationRate',
    ]) {
      expect(body[key]).toEqual({ value: null, status: 'unavailable' });
    }
    expect(typeof body.generatedAt).toBe('string');
  });

  it('still fails the request when the database itself fails', async () => {
    rpcResult = { data: null, error: { message: 'connection reset' } };
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(500);
  });
});

describe('the response is exactly the contract, and has no room for a resident', () => {
  it('validates against SpaceMetricsResponseSchema', async () => {
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    expect(SpaceMetricsResponseSchema.safeParse(body).success).toBe(true);
  });

  it('carries no field the contract does not name', async () => {
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    // `.strict()` is what turns the contract into an allow-list: a stray field
    // added upstream fails here rather than reaching a browser.
    const strict = SpaceMetricsResponseSchema.strict().safeParse(body);
    expect(strict.success).toBe(true);
  });

  /**
   * The guarantee is structural — the RPC returns nine scalars and the mapping
   * builds four figures — so this regex should be impossible to trip. That is
   * the point: it fails loudly the day someone widens the shape.
   */
  it.each([
    ['a populated space', metricsRow()],
    ['a suppressed space', metricsRow({ registered_residents: 3, registered_residents_status: 'suppressed' })],
    ['an empty space', null],
  ])('never serializes anything resident-shaped — %s', async (_name, row) => {
    rpcResult = { data: row, error: null };
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    const serialized = JSON.stringify(await res.json());
    expect(serialized).not.toMatch(/@|\+972|id_number|did:sync|first_name|userId/);
  });
});

describe('metrics is capability-gated and space-scoped', () => {
  it('denies a caller who administers the space but holds no metrics.read', async () => {
    grantOnlyInSpaceA(['proposal.read']);
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN_BODY);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('returns the identical opaque 403 for a swapped space id', async () => {
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_B}/metrics`),
      ctx(SPACE_B)
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual(FORBIDDEN_BODY);
    expect(JSON.stringify(body)).not.toContain(SPACE_B);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request before any authorization work', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);
    const res = await GET_METRICS(
      req(`/api/space-admin/${SPACE_A}/metrics`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(401);
    expect(findActiveGrant).not.toHaveBeenCalled();
  });
});
