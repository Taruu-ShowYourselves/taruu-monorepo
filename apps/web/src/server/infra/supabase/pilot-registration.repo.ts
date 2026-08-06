import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { PilotRegistrationRow, User } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

export function findPilotRegistration(
  userId: string
): ResultAsync<PilotRegistrationRow | null, AppError> {
  const query = supabaseAdmin
    .from('pilot_registrations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_registrations.find', cause)
  );
}

export function findUserForPilot(userId: string): ResultAsync<User | null, AppError> {
  const query = supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('users.findForPilot', cause));
}

export function municipalityExists(code: string): ResultAsync<boolean, AppError> {
  const query = supabaseAdmin
    .from('municipalities')
    .select('code')
    .eq('code', code)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return Boolean(data);
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('municipalities.exists', cause)
  );
}

export function upsertPilotRegistration(
  row: Omit<PilotRegistrationRow, 'id' | 'created_at' | 'updated_at'>
): ResultAsync<PilotRegistrationRow, AppError> {
  const query = supabaseAdmin
    .from('pilot_registrations')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*')
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_registrations.upsert', cause)
  );
}

export function setUserPilotMunicipality(
  userId: string,
  municipalityId: string
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('users')
    .update({ municipality_id: municipalityId, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('users.setPilotMunicipality', cause)
  );
}

/** Called after a freshly recorded pilot ballot, preserving consent and attribution. */
export function markPilotParticipant(
  userId: string,
  municipalityId: string
): ResultAsync<void, AppError> {
  return findPilotRegistration(userId).andThen((existing) =>
    upsertPilotRegistration({
      user_id: userId,
      role: 'participant',
      lat: existing?.lat ?? null,
      lng: existing?.lng ?? null,
      accuracy_m: existing?.accuracy_m ?? null,
      location_consent_at: existing?.location_consent_at ?? null,
      consent_version: existing?.consent_version ?? null,
      claimed_municipality_id: existing?.claimed_municipality_id ?? municipalityId,
      gps_municipality_id: existing?.gps_municipality_id ?? null,
      resolved_municipality_id: municipalityId,
      resolution: existing?.resolution ?? 'profile',
      ref_code: existing?.ref_code ?? null,
    }).map(() => undefined)
  );
}
