import { NextRequest, NextResponse } from 'next/server';

// Hebrew-only site. Everything routes under /he.
const LOCALE = 'he';

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

  // Already under /he - serve as-is
  if (pathname === `/${LOCALE}` || pathname.startsWith(`/${LOCALE}/`)) {
    return NextResponse.next();
  }

  // Legacy /en/* (or any other locale prefix) → strip it and send to /he
  const legacyLocaleMatch = pathname.match(/^\/[a-z]{2}(\/.*)?$/);
  if (legacyLocaleMatch && !pathname.startsWith(`/${LOCALE}`)) {
    const rest = legacyLocaleMatch[1] || '';
    return NextResponse.redirect(new URL(`/${LOCALE}${rest}`, request.url));
  }

  // Bare path (e.g. "/", "/votes") → prefix with /he
  return NextResponse.redirect(new URL(`/${LOCALE}${pathname === '/' ? '' : pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!_next|api|static|l/|.*\\..*).*)'],
};
