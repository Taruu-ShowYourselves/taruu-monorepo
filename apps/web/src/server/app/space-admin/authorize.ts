import 'server-only';

/**
 * The single minter of SpaceScope.
 *
 * RLS cannot secure this surface: every server query runs as the Supabase
 * service role, which has BYPASSRLS. Object-level authorization therefore
 * lives in the type system - a repository function takes a SpaceScope, which
 * only this module can construct, and reads the scoping key off it. A
 * caller-supplied spaceId string is untypable at the data layer.
 *
 * Every failure in this module returns the same `forbidden()` with **no reason
 * argument**, so `toHttp` emits the constant `{ error: 'Forbidden', code:
 * 'FORBIDDEN' }`. Malformed id, unknown space, no grant, wrong capability,
 * suspended grant and non-municipal space are indistinguishable to the caller.
 * A NOT_FOUND must never be returned here, or anywhere on a space-admin path:
 * existence is data, and a 404/403 split is a space-enumeration oracle.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { isSpaceAdminEnabled } from '@/lib/features/space-admin';
import type { Capability } from '@/server/domain/space/capability';
import { forbidden, type AppError } from '@/server/http/errors';
import {
  findActiveGrant,
  findGrantsForUser,
} from '@/server/infra/supabase/space.repo';
import type { Session } from '@/services/auth/session';

declare const SpaceScopeBrand: unique symbol;

export interface SpaceScope {
  readonly [SpaceScopeBrand]: true;
  readonly spaceId: string;
  /**
   * Resolved join key into the untouched municipality_id columns.
   *
   * NON-NULLABLE, and authorize() refuses to mint a scope without it. The
   * spaces.type CHECK constraint already admits issue #74's non-municipal
   * types, whose rows carry municipality_code IS NULL - and every scoped query
   * in this phase filters `.eq('municipality_id', scope.municipalityCode)`.
   * With a nullable field the first such row would turn each of those queries
   * into `.eq(col, null)`, which matches nothing, with no guard and no error.
   * Refusing at the door is the honest behaviour until #74 gives those types a
   * scoping key of their own.
   */
  readonly municipalityCode: string;
  readonly userId: string;
  /**
   * The capability this scope was minted FOR. Carried for auditing and for
   * reading at the use-case layer - no repository checks it. The brand stops a
   * raw caller-supplied string reaching the data layer; it does not stop a
   * scope minted for one capability being passed to a repository belonging to
   * another. Capability correctness is the use-case's job, enforced by the
   * capability-matrix test.
   */
  readonly capability: Capability;
}

declare const SpaceMembershipBrand: unique symbol;

/** Enough to render the shell and the capability manifest. NOT enough to read data. */
export interface SpaceMembership {
  readonly [SpaceMembershipBrand]: true;
  readonly spaceId: string;
  readonly municipalityCode: string | null;
  readonly userId: string;
  readonly capabilities: readonly Capability[];
  readonly suspended: boolean;
}

const SpaceIdSchema = z.string().uuid();

/**
 * The one escape hatch in the phase, and it is module-private on purpose: a
 * branded interface has no legal constructor, so exactly one unsound cast has
 * to exist somewhere. Keeping it here, and only here, is what lets a grep for
 * that cast serve as the phase's brand-leak audit - outside `__tests__` it must
 * match this line and nothing else. A second match anywhere in `src/server` or
 * `src/app` means some caller has forged a scope instead of earning one.
 */
const mintScope = (fields: {
  spaceId: string;
  municipalityCode: string;
  userId: string;
  capability: Capability;
}): SpaceScope => fields as unknown as SpaceScope;

const mintMembership = (fields: {
  spaceId: string;
  municipalityCode: string | null;
  userId: string;
  capabilities: readonly Capability[];
  suspended: boolean;
}): SpaceMembership => fields as unknown as SpaceMembership;

/**
 * Resolve a capability grant into the only token the data layer accepts.
 *
 * One indexed hit per request against `idx_grant_resolver`; nothing is cached,
 * which is what makes SPACE-09 suspension effective on the very next request.
 */
export function authorize(
  session: Session,
  rawSpaceId: string,
  capability: Capability
): ResultAsync<SpaceScope, AppError> {
  // Kill switch. Denies rather than 404s, for the same non-disclosure reason.
  if (!isSpaceAdminEnabled()) return errAsync(forbidden());

  // A 400 for a malformed id and a 403 for a real one is an existence oracle,
  // so a bad uuid is a denial and never reaches the database.
  const id = SpaceIdSchema.safeParse(rawSpaceId);
  if (!id.success) return errAsync(forbidden());

  return findActiveGrant(session.userId, id.data, capability).andThen((grant) => {
    if (grant === null) return errAsync<SpaceScope, AppError>(forbidden());

    // A space with no municipality_code has no scoping key, and every scoped
    // query in this phase joins through municipality_id. Minting a scope with a
    // null code would turn each of those into .eq(col, null) - matching nothing,
    // silently. Issue #74's non-municipal space types are already legal values in
    // the spaces.type CHECK, so this is reachable, not theoretical. Refuse, with
    // the same opaque forbidden() as every other failure so it is not a signal.
    if (grant.municipality_code === null) return errAsync<SpaceScope, AppError>(forbidden());

    return okAsync(
      mintScope({
        spaceId: grant.space_id,
        municipalityCode: grant.municipality_code,
        userId: session.userId,
        capability,
      })
    );
  });
}

/**
 * Resolve shell-level membership: holding at least one grant row in the space,
 * active or suspended.
 *
 * There is deliberately no twelfth `space.read` capability. Reaching the
 * dashboard shell is membership, and the UI capability manifest lists exactly
 * the eleven rows of `CAPABILITIES` - a twelfth would be a twelfth row the spec
 * does not have. See server/domain/space/capability.ts.
 *
 * A suspended admin still resolves, because they must be able to see the
 * suspension banner and the escalation path. `municipalityCode` stays nullable
 * here, unlike SpaceScope's: a membership never keys a query, so a
 * non-municipal space can still render its shell even though no capability
 * scope can be minted for it.
 */
export function resolveMembership(
  session: Session,
  rawSpaceId: string
): ResultAsync<SpaceMembership, AppError> {
  if (!isSpaceAdminEnabled()) return errAsync(forbidden());

  const id = SpaceIdSchema.safeParse(rawSpaceId);
  if (!id.success) return errAsync(forbidden());

  return findGrantsForUser(session.userId, id.data).andThen((rows) => {
    // Zero grant rows is a denial with no space identity attached; the page then
    // renders NoPermissionPanel, which is what keeps this from being an oracle.
    if (rows.length === 0) return errAsync<SpaceMembership, AppError>(forbidden());

    const active = rows.filter((row) => row.suspended_at === null);

    return okAsync(
      mintMembership({
        spaceId: id.data,
        municipalityCode: rows[0].municipality_code,
        userId: session.userId,
        capabilities: active.map((row) => row.capability),
        suspended: active.length === 0,
      })
    );
  });
}
