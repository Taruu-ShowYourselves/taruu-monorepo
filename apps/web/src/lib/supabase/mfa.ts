/**
 * MFA data access (Issue #71, migrations 20260901000002/-03).
 *
 * Same idiom as db.ts: every function goes through `supabaseAdmin`
 * (service role), destructures `{ data, error }`, and returns null/false on
 * error - callers treat that as "refuse", never as "matches".
 *
 * Every operation whose atomicity carries a security invariant is a database
 * RPC, not a query built here: single-use consumes, the monotonic TOTP step
 * guard, attempt counters, and the multi-statement disable. PostgREST cannot
 * express `col = col + 1` or a transaction, and the conditional
 * `UPDATE ... RETURNING` under row locking is the exactly-one-winner
 * primitive the engineering model requires (§5.5). A boolean RPC returns
 * TRUE for the winner and NULL for everyone else; the wrappers below collapse
 * both NULL and errors to `false` - fail closed.
 */

import { supabaseAdmin } from './server';
import type {
  MfaFactorRow,
  MfaPendingTokenRow,
  ReauthTicketRow,
  ReauthPurpose,
  ReauthMethod,
  SecuritySettingsRow,
} from './types';

/** Stale-pending horizon (canonical §6.1): older pending rows are replaced. */
export const PENDING_FACTOR_MAX_AGE_MINUTES = 15;
/** Pending-challenge lifetime (canonical §5.3). */
export const PENDING_TOKEN_TTL_SECONDS = 5 * 60;
/** Reauth-ticket lifetime (canonical §5.4). */
export const REAUTH_TICKET_TTL_SECONDS = 5 * 60;

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

export async function getActiveFactor(userId: string): Promise<MfaFactorRow | null> {
  const { data, error } = await supabaseAdmin
    .from('user_mfa_factors')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getPendingFactor(userId: string): Promise<MfaFactorRow | null> {
  const { data, error } = await supabaseAdmin
    .from('user_mfa_factors')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Opportunistic cleanup at enrollment start: a pending row older than the
 * §6.1 horizon is treated as absent and deleted so the new enrollment can
 * take the partial-unique slot. No cron dependency.
 */
export async function deleteStalePendingFactor(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_FACTOR_MAX_AGE_MINUTES * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('user_mfa_factors')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('created_at', cutoff);
}

/** Deletes an in-window pending row too - restart-enrollment replaces it. */
export async function deletePendingFactor(userId: string): Promise<void> {
  await supabaseAdmin
    .from('user_mfa_factors')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'pending');
}

export async function insertPendingFactor(row: {
  id: string;
  user_id: string;
  secret_enc: string;
  enc_key_version: number;
}): Promise<MfaFactorRow | null> {
  const { data, error } = await supabaseAdmin
    .from('user_mfa_factors')
    .insert({ ...row, factor_type: 'totp' as const, status: 'pending' as const })
    .select()
    .single();
  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Atomic RPCs (the invariant carriers)
// ---------------------------------------------------------------------------

export async function acceptTotpStep(
  factorId: string,
  userId: string,
  step: number
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mfa_accept_totp_step', {
    p_factor_id: factorId,
    p_user_id: userId,
    p_step: step,
  });
  if (error) return false;
  return data === true;
}

export async function incrementConfirmAttempts(
  factorId: string,
  userId: string
): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('mfa_increment_confirm_attempts', {
    p_factor_id: factorId,
    p_user_id: userId,
  });
  if (error || typeof data !== 'number') return null;
  return data;
}

export async function activateFactor(
  factorId: string,
  userId: string,
  step: number,
  batchId: string,
  codeHashes: string[]
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mfa_activate_factor', {
    p_factor_id: factorId,
    p_user_id: userId,
    p_step: step,
    p_batch_id: batchId,
    p_code_hashes: codeHashes,
  });
  if (error) return false;
  return data === true;
}

export async function consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mfa_consume_recovery_code', {
    p_user_id: userId,
    p_code_hash: codeHash,
  });
  if (error) return false;
  return data === true;
}

export async function regenerateRecoveryCodes(
  userId: string,
  batchId: string,
  codeHashes: string[]
): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('mfa_regenerate_recovery_codes', {
    p_user_id: userId,
    p_batch_id: batchId,
    p_code_hashes: codeHashes,
  });
  if (error || typeof data !== 'number') return null;
  return data;
}

export async function disableFactor(
  userId: string,
  reason: 'user' | 'operator_reset'
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mfa_disable_factor', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) return false;
  return data === true;
}

export async function bumpSessionVersion(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('users_bump_session_version', {
    p_user_id: userId,
  });
  if (error || typeof data !== 'number') return null;
  return data;
}

export async function consumePendingToken(id: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('mfa_consume_pending_token', {
    p_id: id,
    p_user_id: userId,
  });
  if (error) return false;
  return data === true;
}

export async function recordPendingAttempt(id: string, userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('mfa_record_pending_attempt', {
    p_id: id,
    p_user_id: userId,
  });
  if (error || typeof data !== 'number') return null;
  return data;
}

export async function consumeReauthTicket(
  id: string,
  userId: string,
  purpose: ReauthPurpose
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('reauth_consume_ticket', {
    p_id: id,
    p_user_id: userId,
    p_purpose: purpose,
  });
  if (error) return false;
  return data === true;
}

// ---------------------------------------------------------------------------
// Pending challenge rows
// ---------------------------------------------------------------------------

export async function insertPendingToken(row: {
  id: string;
  user_id: string;
  ip_hash: string | null;
  user_agent: string | null;
}): Promise<MfaPendingTokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from('mfa_pending_tokens')
    .insert({
      ...row,
      expires_at: new Date(Date.now() + PENDING_TOKEN_TTL_SECONDS * 1000).toISOString(),
    })
    .select()
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * Row read for challenge-state classification (expired vs consumed vs
 * exhausted -> the right error code and event). The atomic consume RPC
 * remains the only authority for the accept decision.
 */
export async function getPendingToken(id: string): Promise<MfaPendingTokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from('mfa_pending_tokens')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Rows past expires_at + 24h are forensically spent - opportunistic cleanup at mint. */
export async function deleteExpiredPendingTokens(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('mfa_pending_tokens').delete().lt('expires_at', cutoff);
}

/** Durable mint ceiling (§9): pending challenges created in the last hour. */
export async function countPendingTokensSince(
  userId: string,
  sinceIso: string
): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from('mfa_pending_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso);
  if (error || count === null) return null;
  return count;
}

// ---------------------------------------------------------------------------
// Reauth tickets
// ---------------------------------------------------------------------------

export async function insertReauthTicket(row: {
  id: string;
  user_id: string;
  purpose: ReauthPurpose;
  method: ReauthMethod;
}): Promise<ReauthTicketRow | null> {
  const { data, error } = await supabaseAdmin
    .from('reauth_tickets')
    .insert({
      ...row,
      expires_at: new Date(Date.now() + REAUTH_TICKET_TTL_SECONDS * 1000).toISOString(),
    })
    .select()
    .single();
  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Recovery codes / settings / derived facts
// ---------------------------------------------------------------------------

export async function countUnusedRecoveryCodes(userId: string): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from('user_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  if (error || count === null) return null;
  return count;
}

export async function getSecuritySettings(): Promise<SecuritySettingsRow | null> {
  const { data, error } = await supabaseAdmin
    .from('security_settings')
    .select('*')
    .eq('id', true)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * required_asr's DB derivation (canonical §4.5): 'mf' iff an active factor
 * exists AND global enforcement is on. Null means a read failed - callers
 * must treat that as an error, never as 'sf' (a silent downgrade).
 *
 * Per-request only. NO cross-request caching of either read - the same rule
 * as getUserSessionVersion: a cache would relax revocation and enforcement
 * from "immediate" to "up to cache TTL".
 */
export async function userRequiresMfa(userId: string): Promise<boolean | null> {
  const settings = await getSecuritySettings();
  if (settings === null) return null;
  if (!settings.mfa_enforcement_enabled) return false;

  const { count, error } = await supabaseAdmin
    .from('user_mfa_factors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error || count === null) return null;
  return count > 0;
}
