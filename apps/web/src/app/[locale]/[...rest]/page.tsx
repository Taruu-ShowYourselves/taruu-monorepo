import { notFound } from 'next/navigation';

/**
 * Catch-all for unmatched /he/* paths. Next.js only renders a nested
 * not-found boundary when notFound() is thrown inside its segment, so without
 * this route any stale URL — including the removed money-only routes
 * (/he/economics, /he/coin, /he/coin/[id]) — would fall through to the bare
 * framework 404 (English, LTR, no chrome). Specific routes always win over a
 * catch-all, so live pages are unaffected.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
