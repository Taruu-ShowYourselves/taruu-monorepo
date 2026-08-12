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

/**
 * The account's required assurance level - the §4.5 primitive the refresh
 * route re-derives on every call. In M1 this returns `sf` unconditionally:
 * there is no MFA table yet, so every account requires only single-factor
 * assurance. M2 replaces only this function's body with the
 * `user_mfa_factors` + `security_settings` derivation; it already takes
 * `userId` so no M2 call site has to change.
 */
export async function getRequiredAssurance(userId: string): Promise<Assurance> {
  void userId;
  return 'sf';
}
