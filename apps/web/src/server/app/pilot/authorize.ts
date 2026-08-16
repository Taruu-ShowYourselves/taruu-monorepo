/**
 * Pilot-desk authorization: the pilot console is cross-municipality founder
 * tooling, so it sits behind the PLATFORM gate, never a SpaceScope.
 *
 * Grants access to either a live `super_admin` role grant or the
 * `users.is_platform_admin` bootstrap flag. A non-FORBIDDEN failure (a DB
 * outage) propagates as 500 and never degrades into a spurious 403.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { requireRole } from '@/server/app/authz/require-role';
import { readIsPlatformAdmin } from '@/server/infra/supabase/pilot.repo';
import { forbidden, unauthorized, type AppError } from '@/server/http/errors';
import type { Session } from '@/services/auth/session';

export interface PilotAdmin {
  userId: string;
}

export function requirePilotAdmin(
  session: Session | null
): ResultAsync<PilotAdmin, AppError> {
  if (!session) return errAsync(unauthorized());
  const { userId } = session;

  return requireRole(userId, 'super_admin', null)
    .map<PilotAdmin>(() => ({ userId }))
    .orElse((error) => {
      if (error.kind !== 'FORBIDDEN') return errAsync<PilotAdmin, AppError>(error);
      return readIsPlatformAdmin(userId).andThen((isAdmin) =>
        isAdmin
          ? okAsync<PilotAdmin, AppError>({ userId })
          : errAsync<PilotAdmin, AppError>(forbidden('not_platform_admin'))
      );
    });
}
