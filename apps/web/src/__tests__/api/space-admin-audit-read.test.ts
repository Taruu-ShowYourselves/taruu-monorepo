/**
 * Audit history read — SPACE-04's readable half.
 *
 * The repository under test here is the real one: only `supabaseAdmin` is
 * stubbed, so every assertion about a predicate is an assertion about the query
 * that would have been sent, not about a filter applied after the fetch. That
 * matters most for the space predicate, which must survive every filter
 * combination — a narrowing filter that quietly widened the space would be the
 * exact cross-space read SPACE-03 forbids.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import { AuditPageSchema } from '@sync/shared/contracts';
import {
  MUNICIPALITY_A,
  OTHER_USER_ID,
  SESSION,
  SPACE_A,
  SPACE_B,
  auditRow,
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
let queryResult: { data: unknown; error: unknown } = { data: [], error: null };
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
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { GET as GET_AUDIT } from '@/app/api/space-admin/[spaceId]/audit/route';

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

const FORBIDDEN_BODY = { error: 'Forbidden', code: 'FORBIDDEN' };

const uuid = (n: number) => `${String(n).repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

/** `n` rows, newest first, one minute apart, with distinct ids. */
const pageOf = (n: number, startMinute = 0) =>
  Array.from({ length: n }, (_, i) =>
    auditRow({
      id: uuid((startMinute + i) % 10),
      created_at: `2026-07-30T09:${String(59 - startMinute - i).padStart(2, '0')}:00.000Z`,
    })
  );

function grantOnlyInSpaceA(capabilities: string[]) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

/** Every `.eq()` column the recorded query filtered on. */
const filteredColumns = () =>
  (lastBuilder?.spies.eq.mock.calls ?? []).map(([column]) => column);

beforeEach(() => {
  vi.clearAllMocks();
  lastBuilder = null;
  queryResult = { data: pageOf(3), error: null };
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  grantOnlyInSpaceA(['audit.read']);
});

describe('GET /api/space-admin/[spaceId]/audit', () => {
  it('returns a page shaped rows / nextCursor / truncated and nothing else', async () => {
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['nextCursor', 'rows', 'truncated']);
    expect(body.rows).toHaveLength(3);
  });

  it('always carries the space predicate from the scope', async () => {
    await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    expect(fromSpy).toHaveBeenCalledWith('space_audit_log');
    expect(lastBuilder?.spies.eq).toHaveBeenCalledWith('space_id', SPACE_A);
  });

  it('orders newest first on the composite sort key', async () => {
    await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    expect(lastBuilder?.spies.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(lastBuilder?.spies.order).toHaveBeenCalledWith('id', { ascending: false });
  });

  it('narrows by objectType without dropping the space predicate', async () => {
    await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?objectType=grant`),
      ctx(SPACE_A)
    );
    expect(lastBuilder?.spies.eq).toHaveBeenCalledWith('object_type', 'grant');
    expect(filteredColumns()).toContain('space_id');
  });

  it('narrows by actor without dropping the space predicate', async () => {
    await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?actor=${OTHER_USER_ID}`),
      ctx(SPACE_A)
    );
    expect(lastBuilder?.spies.eq).toHaveBeenCalledWith('actor_user_id', OTHER_USER_ID);
    expect(filteredColumns()).toContain('space_id');
  });

  it('caps an oversized page at 100 rows and says so', async () => {
    queryResult = { data: pageOf(4), error: null };
    const res = await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?limit=150`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    // limit + 1: the extra row is how another page is detected without a count.
    expect(lastBuilder?.spies.limit).toHaveBeenCalledWith(101);
    expect(body.truncated).toBe(true);
  });
});

describe('cursor pagination walks the log without repeating or skipping a row', () => {
  it('feeds nextCursor back, sends a keyset predicate, and gets a disjoint page', async () => {
    queryResult = { data: pageOf(3, 0), error: null };
    const first = await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?limit=2`),
      ctx(SPACE_A)
    );
    const pageOne = await first.json();
    expect(pageOne.rows).toHaveLength(2);
    expect(pageOne.nextCursor).toEqual(expect.any(String));

    // The cursor is one opaque URL-safe token, not two column values the client
    // could assemble — or tamper with — itself.
    expect(pageOne.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);

    const lastOfPageOne = pageOne.rows[1];

    queryResult = { data: pageOf(2, 5), error: null };
    const second = await GET_AUDIT(
      req(
        `/api/space-admin/${SPACE_A}/audit?limit=2&cursor=${encodeURIComponent(pageOne.nextCursor)}`
      ),
      ctx(SPACE_A)
    );
    const pageTwo = await second.json();

    // Page two's recorded query pages by key, not by offset: strictly older
    // than the last row shown, with the id breaking a same-instant tie.
    expect(lastBuilder?.spies.or).toHaveBeenCalledWith(
      `created_at.lt.${lastOfPageOne.createdAt},` +
        `and(created_at.eq.${lastOfPageOne.createdAt},id.lt.${lastOfPageOne.id})`
    );
    expect(lastBuilder?.spies.eq).toHaveBeenCalledWith('space_id', SPACE_A);

    const firstIds = pageOne.rows.map((row: { id: string }) => row.id);
    const secondIds = pageTwo.rows.map((row: { id: string }) => row.id);
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    expect(pageTwo.nextCursor).toBeNull();
  });

  it('sends no keyset predicate on the first page', async () => {
    await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    expect(lastBuilder?.spies.or).not.toHaveBeenCalled();
  });

  it('rejects a cursor that is not one this server issued', async () => {
    const res = await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?cursor=bm90YWN1cnNvcg`),
      ctx(SPACE_A)
    );
    expect(res.status).toBe(400);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('exhausts the log with a null cursor rather than an empty page', async () => {
    queryResult = { data: pageOf(2), error: null };
    const res = await GET_AUDIT(
      req(`/api/space-admin/${SPACE_A}/audit?limit=5`),
      ctx(SPACE_A)
    );
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
    expect(body.truncated).toBe(false);
  });
});

describe('the page is exactly the contract', () => {
  it('validates against AuditPageSchema', async () => {
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    const body = await res.json();
    expect(AuditPageSchema.safeParse(body).success).toBe(true);
    expect(AuditPageSchema.strict().safeParse(body).success).toBe(true);
  });

  it('gives every row the six columns the surface renders, in camelCase', async () => {
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    const body = await res.json();
    const [row] = body.rows;

    // מתי · מי · פעולה · אובייקט · ממצב → למצב · נימוק
    expect(row.createdAt).toBe('2026-07-30T09:59:00.000Z');
    expect(row.actorDisplayName).toBe('דנה לוי');
    expect(row.action).toBe('proposal.approved');
    expect(row.objectType).toBe('vote');
    expect(row).toHaveProperty('priorState');
    expect(row).toHaveProperty('newState');
    expect(row.reason).toContain('ההצעה עומדת בכללי המרחב');

    // The mapping happened: no database column name survives into the payload,
    // and the embedded actor object is gone with them.
    for (const raw of [
      'created_at',
      'actor_user_id',
      'object_type',
      'object_id',
      'prior_state',
      'new_state',
      'actor_first_name',
      'space_id',
      'users',
    ]) {
      expect(row).not.toHaveProperty(raw);
    }
  });

  it('labels an actor whose name was never recorded, in Hebrew', async () => {
    queryResult = {
      data: [auditRow({ users: { first_name: null, last_name: null } })],
      error: null,
    };
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    const body = await res.json();
    expect(body.rows[0].actorDisplayName).toBe('מנהל/ת מרחב');
  });
});

describe('audit read is capability-gated and space-scoped', () => {
  it('denies a caller who administers the space but holds no audit.read', async () => {
    grantOnlyInSpaceA(['proposal.read']);
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_A}/audit`), ctx(SPACE_A));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN_BODY);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('returns the identical opaque 403 for a swapped space id', async () => {
    const res = await GET_AUDIT(req(`/api/space-admin/${SPACE_B}/audit`), ctx(SPACE_B));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual(FORBIDDEN_BODY);
    expect(JSON.stringify(body)).not.toContain(SPACE_B);
  });

  it('denies before validating a cursor, so a bad cursor is never an oracle', async () => {
    const res = await GET_AUDIT(
      req(`/api/space-admin/${SPACE_B}/audit?cursor=%%%notbase64`),
      ctx(SPACE_B)
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN_BODY);
  });
});
