/**
 * Assurance representation (canonical §4.5) - replaces Supabase's literal
 * `aal1`/`aal2`, which this stack cannot use (Supabase Auth is disabled).
 *
 * `amr` is an ordered method list (`google`, and from M2 onward `totp`,
 * `recovery`). `asr` is the binary assurance level derived at mint: `mf` iff
 * `amr` contains a second factor, else `sf`.
 */

export type Assurance = 'sf' | 'mf';

/** M1 login defaults: every Google sign-in mints a single-factor session. */
export const DEFAULT_LOGIN_AMR: readonly string[] = ['google'];
export const DEFAULT_LOGIN_ASR: Assurance = 'sf';

const ASSURANCE_RANK: Readonly<Record<Assurance, number>> = { sf: 0, mf: 1 };

/** True when `actual` meets or exceeds `required` - `mf` outranks `sf`. */
export function assuranceMeets(actual: Assurance, required: Assurance): boolean {
  return ASSURANCE_RANK[actual] >= ASSURANCE_RANK[required];
}

/** Assurance methods and their mint-time semantics (canonical §4.5/§6.2a). */
export const AMR_GOOGLE = 'google';
export const AMR_TOTP = 'totp';
export const AMR_RECOVERY = 'recovery';

/** `mf` iff the method list contains a second factor. */
export function deriveAssurance(amr: readonly string[]): Assurance {
  return amr.includes(AMR_TOTP) || amr.includes(AMR_RECOVERY) ? 'mf' : 'sf';
}

/**
 * The account's required assurance level - the §4.5 primitive the refresh
 * route re-derives on every call, and the login callback consults to decide
 * between minting a session and opening a challenge:
 *
 *   required = 'mf' iff an active user_mfa_factors row exists
 *                    AND security_settings.mfa_enforcement_enabled
 *
 * Both facts are read from the database per call - never cached across
 * requests, never taken from token claims. Throws when either read fails:
 * an unknown enforcement state must surface as an error, never degrade to a
 * silent 'sf' (that would be an assurance bypass an attacker could induce by
 * hurting the database).
 */
export async function getRequiredAssurance(userId: string): Promise<Assurance> {
  // Lazy import keeps this module import-safe for client-adjacent test
  // fixtures that only need the constants above.
  const { userRequiresMfa } = await import('@/lib/supabase/mfa');
  const requires = await userRequiresMfa(userId);
  if (requires === null) {
    throw new Error('required-assurance derivation failed - refusing to guess');
  }
  return requires ? 'mf' : 'sf';
}
