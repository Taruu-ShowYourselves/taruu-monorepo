import type { PilotRegisterRequest, PilotRegisterResponse } from '@sync/shared/contracts';
import { municipalityFromCoords } from '@sync/shared';
import { errAsync, type ResultAsync } from 'neverthrow';
import { conflict, notFound, validation, type AppError } from '@/server/http/errors';
import { findPilotLink } from '@/server/infra/supabase/pilot-link.repo';
import {
  findPilotRegistration,
  findUserForPilot,
  municipalityExists,
  setUserPilotMunicipality,
  upsertPilotRegistration,
} from '@/server/infra/supabase/pilot-registration.repo';
import { findCohortRow } from '@/server/infra/supabase/pilot.repo';
import type { Session } from '@/services/auth/session';

export function registerPilot(
  session: Session | null,
  command: PilotRegisterRequest,
  cookieRefCode: string | null
): ResultAsync<PilotRegisterResponse, AppError> {
  if (!session) return errAsync({ kind: 'UNAUTHORIZED' });

  return findUserForPilot(session.userId).andThen((user) => {
    if (!user) return errAsync<PilotRegisterResponse, AppError>(notFound('user'));

    const claimedMunicipality = command.municipalityId ?? null;
    const gpsMunicipality = command.coords
      ? municipalityFromCoords(command.coords.lat, command.coords.lng)?.name ?? null
      : null;
    const resolvedMunicipality = claimedMunicipality ?? gpsMunicipality ?? user.municipality_id ?? null;
    const resolution = claimedMunicipality
      ? 'manual' as const
      : gpsMunicipality
        ? 'gps' as const
        : user.municipality_id
          ? 'profile' as const
          : 'none' as const;

    if (!resolvedMunicipality) {
      return errAsync<PilotRegisterResponse, AppError>(
        validation(['choose a municipality or share location before registering'])
      );
    }

    return municipalityExists(resolvedMunicipality).andThen((exists) => {
      if (!exists) {
        return errAsync<PilotRegisterResponse, AppError>(validation(['unknown municipality']));
      }
      return findCohortRow(resolvedMunicipality).andThen((cohort) => {
        if (command.role === 'participant' && (!cohort || cohort.status !== 'active')) {
          return errAsync<PilotRegisterResponse, AppError>(
            conflict('participant registration is open only in an active pilot municipality')
          );
        }

        const requestedRef = cookieRefCode ?? command.refCode ?? null;
        const resolveRef = requestedRef
          ? findPilotLink(requestedRef).map((link) => (link?.disabled_at ? null : link?.code ?? null))
          : undefined;
        return (resolveRef ?? findPilotRegistration(session.userId).map((existing) => existing?.ref_code ?? null))
          .andThen((refCode) =>
            findPilotRegistration(session.userId).andThen((existing) =>
              upsertPilotRegistration({
                user_id: session.userId,
                role: command.role,
                lat: command.coords?.lat ?? null,
                lng: command.coords?.lng ?? null,
                accuracy_m: command.coords?.accuracyM ?? null,
                location_consent_at: command.coords ? new Date().toISOString() : existing?.location_consent_at ?? null,
                consent_version: command.coords ? command.consentVersion ?? null : existing?.consent_version ?? null,
                claimed_municipality_id: claimedMunicipality,
                gps_municipality_id: gpsMunicipality,
                resolved_municipality_id: resolvedMunicipality,
                resolution,
                // First-touch attribution is kept when the resident returns through another link.
                ref_code: existing?.ref_code ?? refCode,
              })
            )
          )
          .andThen(() => setUserPilotMunicipality(session.userId, resolvedMunicipality))
          .map(() => ({
            role: command.role,
            resolvedMunicipality,
            claimedMunicipality,
            gpsMunicipality,
            locationMismatch:
              Boolean(claimedMunicipality && gpsMunicipality) && claimedMunicipality !== gpsMunicipality,
            resolution,
            isPilotMunicipality: Boolean(cohort && cohort.status === 'active'),
          }));
      });
    });
  });
}
