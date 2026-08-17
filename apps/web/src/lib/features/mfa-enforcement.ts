/**
 * Global MFA enforcement - a feature-flag-shaped reader over the ONE
 * authority: `security_settings.mfa_enforcement_enabled` (canonical §5.6).
 *
 * There is deliberately no MFA_ENFORCEMENT_ENABLED environment variable
 * anywhere in this codebase: the DB-owned security_score trigger must read
 * the same value login behavior uses, and the M8 flip must be transactional
 * with the score recompute - an env flip is a redeploy with no transaction
 * semantics and per-instance drift.
 *
 * Read per request. A within-request memo is fine; a cross-request cache is
 * NOT - this value participates in required_asr, so caching it relaxes
 * enforcement from "immediate" to "up to cache TTL" (the §4.4 cache rule).
 * Throws on a failed read: enforcement state must never be silently guessed.
 * An ABSENT schema (table not migrated / singleton unseeded) is not a failed
 * read - getSecuritySettings resolves it to enforcement OFF permanently.
 */

import { getSecuritySettings } from '@/lib/supabase/mfa';

export async function isMfaEnforcementEnabled(): Promise<boolean> {
  const settings = await getSecuritySettings();
  if (settings === null) {
    throw new Error('security_settings read failed - enforcement state unknown');
  }
  return settings.mfa_enforcement_enabled;
}
