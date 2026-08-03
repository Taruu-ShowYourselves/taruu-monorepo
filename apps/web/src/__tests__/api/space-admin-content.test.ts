/**
 * Permitted content and the escalation path — SPACE-06 and SPACE-09.
 *
 * The two halves of this file are governed by opposite rules, which is why
 * they live together: content moderation is capability-gated, scoped and
 * audited like every other mutation in the phase, while escalation is
 * deliberately none of those things. Reading them side by side is the point.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { errAsync, okAsync } from 'neverthrow';
import { conflict } from '@/server/http/errors';
import { MUNICIPALITY_A, SESSION, SPACE_A, SPACE_B, USER_ID } from '../fixtures/space';

const { limiterCheck } = vi.hoisted(() => ({ limiterCheck: vi.fn() }));

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space-audit.repo', () => ({
  insertAuditRow: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space-member.repo', () => ({
  setContentModeration: vi.fn(),
  insertEscalation: vi.fn(),
  isPlatformAdmin: vi.fn(),
}));

/**
 * The limiter is stubbed rather than exercised: the real one keeps process-wide
 * state, so a five-case opacity table would start answering 429 partway
 * through and the test would be asserting the limiter instead of the endpoint.
 */
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({ check: limiterCheck, reset: vi.fn() })),
  createRateLimitResponse: (result: { remaining: number; resetIn: number }) =>
    new Response(JSON.stringify({ error: 'rate limited', ...result }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { findActiveGrant, findGrantsForUser } from '@/server/infra/supabase/space.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  insertEscalation,
  setContentModeration,
} from '@/server/infra/supabase/space-member.repo';
import { createRateLimiter } from '@/lib/rate-limit';
import { POST as POST_CONTENT } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/content/route';
import { POST as POST_ESCALATION } from '@/app/api/space-admin/[spaceId]/escalations/route';
import { ESCALATION_ACKNOWLEDGEMENT } from '@/server/app/space-admin/raise-escalation';

/**
 * Snapshotted at import time. The limiter is constructed when the route module
 * loads, and `vi.clearAllMocks()` in `beforeEach` would erase that call before
 * any test could read it.
 */
const limiterConstruction = [...(createRateLimiter as unknown as Mock).mock.calls];

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
/** Well-formed, and deliberately matching no row in any fixture. */
const NONEXISTENT_UUID = '99999999-9999-4999-8999-999999999999';
const REASON = 'התוכן חורג מכללי המרחב';
const BODY = 'ההרשאה שלי הושעתה ואני מבקש בירור';

const contentCtx = (spaceId: string) => ({
  params: Promise.resolve({ spaceId, voteId: VOTE_ID }),
});
const ctx = (spaceId: string) => ({ params: Promise.resolve({ spaceId }) });

const json = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

const moderationRequest = (action: string, spaceId: string = SPACE_A) =>
  POST_CONTENT(
    json(
      `http://localhost/api/space-admin/${spaceId}/proposals/${VOTE_ID}/content`,
      { action, reason: REASON }
    ),
    contentCtx(spaceId)
  );

const escalate = (spaceId: string, body: string = BODY) =>
  POST_ESCALATION(
    json(`http://localhost/api/space-admin/${spaceId}/escalations`, { body }),
    ctx(spaceId)
  );

function holdsContentModerate(space: string = SPACE_A) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, wanted) =>
    okAsync(
      spaceId === space && wanted === 'content.moderate'
        ? { space_id: space, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (findActiveGrant as Mock).mockReturnValue(okAsync(null));
  (findGrantsForUser as Mock).mockReturnValue(okAsync([]));
  (insertAuditRow as Mock).mockReturnValue(okAsync({ id: 'audit-1' }));
  (insertEscalation as Mock).mockReturnValue(
    okAsync({ id: 'escalation-1', created_at: '2026-08-03T09:00:00.000Z' })
  );
  limiterCheck.mockResolvedValue({ limited: false, remaining: 4, resetIn: 3_600_000 });
});

// ---------------------------------------------------------------------------
// Permitted content
// ---------------------------------------------------------------------------

const MODERATION: Array<
  [string, { hidden_at: string | null; flagged_at: string | null }, string, unknown, unknown]
> = [
  [
    'hide',
    { hidden_at: '2026-08-03T09:00:00.000Z', flagged_at: null },
    'content.hidden',
    { hidden: false, flagged: false },
    { hidden: true, flagged: false },
  ],
  [
    'unhide',
    { hidden_at: null, flagged_at: null },
    'content.unhidden',
    { hidden: true, flagged: false },
    { hidden: false, flagged: false },
  ],
  [
    'flag',
    { hidden_at: null, flagged_at: '2026-08-03T09:00:00.000Z' },
    'content.flagged',
    { hidden: false, flagged: false },
    { hidden: false, flagged: true },
  ],
  [
    'unflag',
    { hidden_at: null, flagged_at: null },
    'content.unflagged',
    { hidden: false, flagged: true },
    { hidden: false, flagged: false },
  ],
];

describe('POST /api/space-admin/{spaceId}/proposals/{voteId}/content', () => {
  it.each(MODERATION)(
    '%s writes the transition and one %s audit row carrying the whole moderation state',
    async (action, after, auditAction, priorState, newState) => {
      holdsContentModerate();
      (setContentModeration as Mock).mockReturnValue(okAsync({ id: VOTE_ID, ...after }));

      const res = await moderationRequest(action);

      expect(res.status).toBe(200);
      expect(setContentModeration).toHaveBeenCalledWith(
        expect.anything(),
        VOTE_ID,
        action
      );
      expect(insertAuditRow).toHaveBeenCalledTimes(1);
      expect(insertAuditRow).toHaveBeenCalledWith(
        expect.objectContaining({
          space_id: SPACE_A,
          actor_user_id: USER_ID,
          action: auditAction,
          object_type: 'content',
          object_id: VOTE_ID,
          prior_state: priorState,
          new_state: newState,
          reason: REASON,
        })
      );
    }
  );

  it('answers 409 when the content is already in the requested state', async () => {
    holdsContentModerate();
    (setContentModeration as Mock).mockReturnValue(
      errAsync(conflict('התוכן כבר מוסתר.'))
    );

    const res = await moderationRequest('hide');

    expect(res.status).toBe(409);
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('refuses a caller without content.moderate', async () => {
    (findActiveGrant as Mock).mockReturnValue(okAsync(null));

    const res = await moderationRequest('hide');

    expect(res.status).toBe(403);
    expect(setContentModeration).not.toHaveBeenCalled();
  });

  it('rejects a reason under ten characters before touching the repository', async () => {
    holdsContentModerate();

    const res = await POST_CONTENT(
      json(
        `http://localhost/api/space-admin/${SPACE_A}/proposals/${VOTE_ID}/content`,
        { action: 'hide', reason: 'קצר' }
      ),
      contentCtx(SPACE_A)
    );

    expect(res.status).toBe(400);
    expect(setContentModeration).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

describe('POST /api/space-admin/{spaceId}/escalations', () => {
  it('accepts an escalation from a caller holding nothing at all', async () => {
    const res = await escalate(SPACE_A);

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual(ESCALATION_ACKNOWLEDGEMENT);
    expect(insertEscalation).toHaveBeenCalledTimes(1);
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('accepts an escalation from a suspended admin', async () => {
    (findGrantsForUser as Mock).mockReturnValue(
      okAsync([
        {
          space_id: SPACE_A,
          municipality_code: MUNICIPALITY_A,
          capability: 'member.read',
          suspended_at: '2026-08-01T00:00:00.000Z',
        },
      ])
    );

    const res = await escalate(SPACE_A);

    expect(res.status).toBe(202);
    expect(insertEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: SPACE_A, rawSpaceId: SPACE_A, raisedBy: USER_ID })
    );
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('preserves the caller input in raw_space_id when the space does not resolve', async () => {
    const res = await escalate('not-a-uuid');

    expect(res.status).toBe(202);
    expect(insertEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: null, rawSpaceId: 'not-a-uuid' })
    );
  });

  it('rejects a body under ten characters', async () => {
    const res = await escalate(SPACE_A, 'קצר');

    expect(res.status).toBe(400);
    expect(insertEscalation).not.toHaveBeenCalled();
  });

  /**
   * The test that fails if anyone reintroduces an existence check or an audit
   * write on this path. Each case establishes a baseline — the answer a fully
   * capable member of their own space gets — and then asserts the target answer
   * is indistinguishable from it, so all four responses are equal by
   * construction rather than by a hard-coded expectation somebody could update.
   */
  const OPAQUE_TARGETS: Array<[string, string]> = [
    ['a space they are not a member of', SPACE_B],
    ['a well-formed uuid matching no space', NONEXISTENT_UUID],
    ['a malformed space id', 'not-a-uuid'],
  ];

  const outcomeOf = async (target: string) => {
    const res = await escalate(target);
    return { status: res.status, body: await res.text() };
  };

  it.each(OPAQUE_TARGETS)(
    'answers %s exactly as it answers their own space',
    async (_label, target) => {
      (findGrantsForUser as Mock).mockImplementation((_userId, spaceId) =>
        okAsync(
          spaceId === SPACE_A
            ? [
                {
                  space_id: SPACE_A,
                  municipality_code: MUNICIPALITY_A,
                  capability: 'member.read',
                  suspended_at: null,
                },
              ]
            : []
        )
      );

      const baseline = await outcomeOf(SPACE_A);
      expect(insertEscalation).toHaveBeenCalledTimes(1);
      (insertEscalation as Mock).mockClear();

      const observed = await outcomeOf(target);

      expect(observed).toEqual(baseline);
      expect(observed.status).toBe(202);
      expect(insertEscalation).toHaveBeenCalledTimes(1);
      expect(insertAuditRow).not.toHaveBeenCalled();
    }
  );

  it('is rate-limited per user, not per space', async () => {
    expect(limiterConstruction).toContainEqual([
      'space-escalation',
      expect.objectContaining({ windowMs: 3_600_000, maxRequests: 5 }),
    ]);

    limiterCheck.mockResolvedValue({ limited: true, remaining: 0, resetIn: 1_000 });

    const res = await escalate(SPACE_A);

    expect(res.status).toBe(429);
    expect(limiterCheck).toHaveBeenCalledWith(USER_ID);
    expect(insertEscalation).not.toHaveBeenCalled();
  });
});
