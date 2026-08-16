import 'server-only';

/**
 * Security events - append and read, and nothing else.
 *
 * This module exports no `update*` and no `delete*` function; that absence is
 * the CI-checkable half of the append-only guarantee (mold:
 * space-audit.repo.ts). The enforceable half is migration 20260901000002: a
 * BEFORE UPDATE/DELETE trigger that raises, a BEFORE TRUNCATE statement
 * trigger, and REVOKE UPDATE/DELETE/TRUNCATE from every role including
 * service_role. The manual probe is supabase/tests/security_mfa.sql.
 *
 * Every §5/§7 transition in specs/mfa-engineering-model.md lists its events;
 * this is their single writer (canonical §8.3). Failures are logged and
 * reported as `false`, never thrown - an evidence write must not fail a
 * login - but the durable rate-limit counters (§9) read the same table, so
 * count readers fail CLOSED: a null count refuses the guarded action rather
 * than waving it through.
 *
 * Never passed in, never stored: TOTP secrets or codes, recovery codes (even
 * hashed), raw tokens, raw IPs. IPs arrive only as ip_hash =
 * SHA-256(ip + SECURITY_EVENT_PEPPER); with no pepper configured the hash is
 * omitted entirely - an unpeppered hash of a low-entropy IP is a lookup
 * table, not an anonymization.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import type { SecurityEventRow, SecurityEventType } from '@/lib/supabase/types';

const USER_AGENT_MAX_CHARS = 256;

export interface SecurityEventEntry {
  userId?: string | null;
  /** Operator for admin actions; omitted/null = self or system. */
  actorUserId?: string | null;
  eventType: SecurityEventType;
  /** The incoming request - used only to derive ip_hash and user_agent. */
  request?: Request;
  reason?: string;
  /** Whitelisted per event type (canonical §8.2). */
  metadata?: Record<string, unknown>;
}

function extractClientIp(request: Request): string | null {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim() || null;
  return null;
}

let warnedMissingPepper = false;

export async function hashClientIp(request: Request): Promise<string | null> {
  const pepper = process.env.SECURITY_EVENT_PEPPER;
  if (!pepper) {
    // Deliberate degradation (header above), but a VISIBLE one: without the
    // pepper every event lands with ip_hash NULL and the forensic field the
    // schema promises is silently empty. Warn once per isolate.
    if (!warnedMissingPepper) {
      warnedMissingPepper = true;
      console.warn(
        'SECURITY_EVENT_PEPPER is not set - security events are recorded without ip_hash'
      );
    }
    return null;
  }
  const ip = extractClientIp(request);
  if (!ip) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + pepper) as BufferSource
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function recordSecurityEvent(entry: SecurityEventEntry): Promise<boolean> {
  try {
    const ipHash = entry.request ? await hashClientIp(entry.request) : null;
    const userAgent = entry.request
      ? entry.request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX_CHARS) ?? null
      : null;

    const { error } = await supabaseAdmin.from('security_events').insert({
      user_id: entry.userId ?? null,
      actor_user_id: entry.actorUserId ?? null,
      event_type: entry.eventType,
      ip_hash: ipHash,
      user_agent: userAgent,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
    });

    if (error) {
      console.error('security event write failed:', entry.eventType, error.code);
      return false;
    }
    return true;
  } catch (cause) {
    console.error('security event write failed:', entry.eventType, cause);
    return false;
  }
}

/**
 * Durable rate-limit window (§9): failures are logged anyway, so the audit
 * log doubles as the counter. Null = the count itself failed; callers refuse
 * the guarded action (fail closed).
 */
export async function countSecurityEventsSince(
  userId: string,
  eventType: SecurityEventType,
  sinceIso: string
): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', sinceIso);
  if (error || count === null) return null;
  return count;
}

/** Same window keyed on the operator (§9's operator-reset ceiling). */
export async function countActorEventsSince(
  actorUserId: string,
  eventType: SecurityEventType,
  sinceIso: string
): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', actorUserId)
    .eq('event_type', eventType)
    .gte('created_at', sinceIso);
  if (error || count === null) return null;
  return count;
}

/** The user's own recent history, newest first - the settings/security feed. */
export async function listOwnSecurityEvents(
  userId: string,
  limit = 20
): Promise<SecurityEventRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('security_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return data;
}
