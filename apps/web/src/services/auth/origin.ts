/**
 * Origin the OAuth exchange's `redirect_uri` is built on.
 *
 * The authorize request is issued against the browser's own origin
 * (`resolveOrigin(request) + GOOGLE_REDIRECT_PATH`), so on localhost the
 * configured app URL is the wrong string and Google answers the token
 * exchange with `redirect_uri_mismatch`. Trust the request's own origin, but
 * only when it is one we recognise - an attacker-supplied origin would
 * otherwise be echoed into the token call.
 *
 * `/api/auth/google/start` and `/api/auth/callback` both call this so the
 * authorize request and the exchange build a byte-identical `redirect_uri` -
 * a mismatch between the two is exactly the failure Google reports as
 * `redirect_uri_mismatch`.
 */
export function resolveOrigin(request: Request): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  // Same-origin POSTs carry an Origin header in every current browser; the URL
  // fallback covers the ones that omit it.
  const sent = (
    request.headers.get('origin') ?? new URL(request.url).origin
  ).replace(/\/$/, '');
  if (sent === configured) return configured;

  // Local development serves the same app from a loopback origin; Google has
  // that URI registered alongside the production one.
  try {
    const { hostname, protocol } = new URL(sent);
    const loopback = hostname === 'localhost' || hostname === '127.0.0.1';
    if (loopback && protocol === 'http:' && process.env.NODE_ENV !== 'production') {
      return sent;
    }
  } catch {
    // Unparseable Origin header - fall through to the configured URL.
  }

  return configured;
}
