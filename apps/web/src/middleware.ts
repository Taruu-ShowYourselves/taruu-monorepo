import { NextRequest, NextResponse } from 'next/server';
import { i18n } from '@/lib/i18n/config';

// Hebrew (the default locale) is served unprefixed: taruu.co.il/votes.
// Bare paths are rewritten to /he internally so the address bar stays clean;
// a visible /he prefix 301s to the bare path. Other locales (/en) keep their
// prefix and are served as-is.
const DEFAULT_LOCALE: string = i18n.defaultLocale;
const PREFIXED_LOCALES = i18n.locales.filter((l) => l !== i18n.defaultLocale);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Canonical host: www → apex. Among other things, OAuth redirect URIs are
  // exchanged against the apex origin - a www visitor signing in would
  // otherwise hit a redirect_uri mismatch at the token endpoint.
  const host = request.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const canonical = new URL(request.url);
    canonical.host = host.slice(4);
    return NextResponse.redirect(canonical, 301);
  }

  // Skip API routes, static files, internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/l/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Visible default-locale prefix → 301 to the bare path. Query string is
  // preserved (the Google OAuth redirect lands on /he/sign-in?code&state and
  // must keep its params through this hop).
  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const bare = request.nextUrl.clone();
    bare.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/';
    return NextResponse.redirect(bare, 301);
  }

  // Prefixed locales (/en/...) are served as-is.
  if (
    PREFIXED_LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  ) {
    return NextResponse.next();
  }

  // Legacy two-letter locale prefix we no longer serve → strip it.
  const legacyLocaleMatch = pathname.match(/^\/[a-z]{2}(\/.*)?$/);
  if (legacyLocaleMatch) {
    const stripped = request.nextUrl.clone();
    stripped.pathname = legacyLocaleMatch[1] || '/';
    return NextResponse.redirect(stripped, 301);
  }

  // Bare path → serve the default locale, URL unchanged.
  const rewritten = request.nextUrl.clone();
  rewritten.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  matcher: ['/((?!_next|api|static|l/|.*\\..*).*)'],
};
