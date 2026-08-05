/**
 * Post-auth redirect sanitising.
 *
 * `/sign-in?redirect=…` and `/verification?redirect=…` both take their target
 * straight from the query string and hand it to `router.push`. An absolute
 * URL there is an open redirect: `/sign-in?redirect=https://evil.example`
 * sends a resident who just signed in to an attacker's page, which is the
 * classic setup for a credential-replay or consent-phishing follow-up. The
 * fact that it happens *after* a successful sign-in is what makes it
 * convincing.
 *
 * The rule is deliberately strict: only same-origin, path-absolute targets
 * survive. Anything else falls back to a caller-supplied default rather than
 * throwing, because a bad redirect must never block the sign-in itself.
 */

/**
 * Returns `candidate` when it is a safe same-origin path, otherwise
 * `fallback`.
 *
 * Rejected, with the attack each rejection closes:
 * - `null` / empty: nothing to honour.
 * - `https://evil.example`, `//evil.example`: absolute and
 *   protocol-relative URLs both navigate off-origin.
 * - `/\evil.example`, `/\/evil.example`: browsers normalise backslashes to
 *   forward slashes, so these are protocol-relative URLs in disguise.
 * - `javascript:…`, `data:…`: non-navigational schemes.
 * - anything not starting with `/`: a bare `evil.example` resolves relative
 *   to the current path and is not a target we ever generate.
 */
export function safeRedirect(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;

  // Must be path-absolute.
  if (!candidate.startsWith('/')) return fallback;

  // Protocol-relative, including the backslash variants browsers normalise.
  const second = candidate[1];
  if (second === '/' || second === '\\') return fallback;

  // Control characters (NUL, CR, LF, TAB) can truncate or split the value in
  // downstream parsers; refuse outright rather than reason about each one.
  if (/[\u0000-\u001F\u007F]/.test(candidate)) return fallback;

  return candidate;
}
