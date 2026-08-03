/**
 * Shared fixtures for the space-admin test files.
 *
 * A deliberate departure from this repo's inline-fixture convention. Roughly
 * ten test files across phase 5 need the *same* two space ids, the same grant
 * row shape and the same PostgREST builder stub, and the whole point of the
 * object-level authorization tests is that space A and space B are consistently
 * distinct everywhere. Re-typing those constants per file is how a test ends up
 * asserting isolation between two ids that are accidentally equal.
 *
 * Nothing here is production code: `scopeFor` casts to `SpaceScope` because a
 * branded interface has no public constructor. That cast lives only under
 * `__tests__`, which is why the phase's brand-leak audit greps with
 * `grep -v __tests__`.
 */

import { vi, type Mock } from 'vitest';
import type { SpaceMembership, SpaceScope } from '@/server/app/space-admin/authorize';
import type { Capability } from '@/server/domain/space/capability';
import type { Session } from '@/services/auth/session';

export const SPACE_A = '11111111-1111-4111-8111-111111111111';
export const SPACE_B = '22222222-2222-4222-8222-222222222222';

export const MUNICIPALITY_A = 'muni-a';
export const MUNICIPALITY_B = 'muni-b';

export const USER_ID = '33333333-3333-4333-8333-333333333333';
export const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';

/** Matches the real `Session` shape — `expiresAt` is a Date, not a number. */
export const SESSION: Session = {
  userId: USER_ID,
  googleId: 'google-abc',
  did: `did:sync:${'a'.repeat(43)}`,
  email: 'admin@example.com',
  expiresAt: new Date(Date.now() + 86_400_000),
};

/** A row as `findActiveGrant` / `findGrantsForUser` project it. */
export function grantRow(
  capability: Capability,
  overrides: Partial<{
    space_id: string;
    municipality_code: string | null;
    suspended_at: string | null;
    granted_via_role: string | null;
  }> = {}
) {
  return {
    space_id: SPACE_A,
    municipality_code: MUNICIPALITY_A,
    capability,
    suspended_at: null,
    granted_via_role: null,
    ...overrides,
  };
}

/** The token `authorize()` would have minted, for repository-level tests. */
export function scopeFor(
  capability: Capability,
  space: string = SPACE_A,
  municipalityCode: string = space === SPACE_A ? MUNICIPALITY_A : MUNICIPALITY_B
): SpaceScope {
  return {
    spaceId: space,
    municipalityCode,
    userId: USER_ID,
    capability,
  } as unknown as SpaceScope;
}

export function membershipFor(
  capabilities: readonly Capability[],
  overrides: Partial<{ spaceId: string; municipalityCode: string | null; suspended: boolean }> = {}
): SpaceMembership {
  return {
    spaceId: SPACE_A,
    municipalityCode: MUNICIPALITY_A,
    userId: USER_ID,
    capabilities,
    suspended: false,
    ...overrides,
  } as unknown as SpaceMembership;
}

/** A `spaces` row as `selectSpaceRow` projects it. */
export function spaceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SPACE_A,
    slug: 'tel-aviv',
    name_he: 'תל אביב-יפו',
    type: 'municipality',
    municipality_code: MUNICIPALITY_A,
    notification_monthly_quota: 4,
    ...overrides,
  };
}

/** A `votes` row as `listProposals` projects it. */
export function proposalRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'הצעה לדוגמה',
    description: 'גוף ההצעה',
    status: 'in_review',
    creator_id: OTHER_USER_ID,
    created_at: '2026-08-01T10:00:00.000Z',
    hidden_at: null,
    flagged_at: null,
    submitter_first_name: 'דנה',
    submitter_last_name: 'לוי',
    ...overrides,
  };
}

/** A `space_audit_log` row with its actor embedded, as `listAuditRows` reads it. */
export function auditRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    space_id: SPACE_A,
    actor_user_id: USER_ID,
    action: 'proposal.approved',
    object_type: 'vote',
    object_id: '55555555-5555-4555-8555-555555555555',
    prior_state: null,
    new_state: null,
    reason: 'ההצעה עומדת בכללי המרחב ולכן אושרה לפרסום',
    created_at: '2026-07-30T09:00:00.000Z',
    users: { first_name: 'דנה', last_name: 'לוי' },
    ...overrides,
  };
}

export type BuilderMethod =
  | 'select'
  | 'eq'
  | 'in'
  | 'is'
  | 'or'
  | 'order'
  | 'limit'
  | 'maybeSingle'
  | 'single';

const BUILDER_METHODS: BuilderMethod[] = [
  'select',
  'eq',
  'in',
  'is',
  'or',
  'order',
  'limit',
  'maybeSingle',
  'single',
];

export interface QueryBuilderStub {
  builder: Record<string, unknown>;
  spies: Record<BuilderMethod, Mock>;
}

/**
 * Chainable PostgREST stub that records every call made on it and finally
 * resolves to `{ data, error, count }`. Lifted from
 * `treasury-transaction-scoping.test.ts`, which is the repo's existing way of
 * asserting that a predicate is in the SQL rather than applied after the fetch.
 */
export function makeQueryBuilder(result: {
  data: unknown;
  error: unknown;
  count?: number | null;
}): QueryBuilderStub {
  const builder: Record<string, unknown> = {};
  const spies = {} as Record<BuilderMethod, Mock>;

  for (const method of BUILDER_METHODS) {
    const spy = vi.fn();
    spies[method] = spy;
    builder[method] = (...args: unknown[]) => {
      spy(...args);
      return builder;
    };
  }

  /**
   * A real promise, not `resolve(result)` directly: the space repositories call
   * `.then(mapper)` and hand the *return value* to `ResultAsync.fromPromise`,
   * which needs a thenable back. Returning the mapped value bare would make
   * every repository throw instead of resolving.
   */
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);

  return { builder, spies };
}
