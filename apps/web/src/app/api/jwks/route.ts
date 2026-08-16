/**
 * Public JWKS (RLS-01).
 *
 * Supabase is registered against this URL as a third-party auth issuer. It
 * fetches the document, caches it, and re-checks periodically; every token
 * minted by ./lib/supabase/user-token.ts is verified against the key published
 * here.
 *
 * Public by design - a JWKS contains only public halves. The route derives them
 * from the private key at request time and strips `d`, so the published key can
 * never drift from the signing key.
 *
 * Also reachable at /.well-known/jwks.json via a rewrite in next.config.ts;
 * that is the conventional path and the one registered with Supabase.
 */

import { NextResponse } from 'next/server';
import { getPublicJwks } from '@/lib/supabase/signing-key';

// No `export const runtime = 'edge'` here, deliberately: on Cloudflare via
// OpenNext every route already runs on workerd, and declaring the edge runtime
// makes the build fail outright ("cannot use the edge runtime"). No other route
// in this app declares one.

export async function GET() {
  try {
    const jwks = await getPublicJwks();
    return NextResponse.json(jwks, {
      headers: {
        // Supabase re-fetches periodically; an hour keeps rotation responsive
        // without making this a hot path.
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Never leak why. An unconfigured key is an operational fact, not something
    // an anonymous caller needs the details of.
    return NextResponse.json({ keys: [] }, { status: 503 });
  }
}
