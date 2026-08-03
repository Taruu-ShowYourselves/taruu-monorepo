/**
 * The audit surface's filter vocabulary and its keyset trail codec, in a module
 * with NO `'use client'` directive — which is the whole reason this file exists.
 *
 * `page.tsx` is a Server Component: it turns `?objectType=` into an
 * `object_type` predicate and `?trail=` into the list of cursors the "newer"
 * control pages back through. Both of those used to be imported from
 * `AuditClient.tsx`, which is a client module — and calling a function exported
 * from a client module on the server throws:
 *
 *     Error: Attempted to call isAuditFilter() from the server but
 *     isAuditFilter is on the client.
 *
 * That is a hard failure of the whole surface, not a degraded one. It is
 * invisible to `tsc`, and `apps/web`'s vitest suite runs with
 * `environment: 'node'` and no React harness, so no test could see it either.
 * Found in 05-16 by loading the page in a browser.
 *
 * The rule this file encodes: a value or function a Server Component reads must
 * not live in a client module. Types are exempt — they are erased before either
 * side runs, which is why `AuditSurfaceState` may stay in `AuditClient.tsx`.
 */

/**
 * The four chips of the copy deck, mapped onto `space_audit_log.object_type`.
 *
 * The column admits seven values; these cover three. `member`, `content`,
 * `space` and `escalation` rows are reachable only under `הכול` — which is the
 * deck's own filter list, not an omission here. Worth knowing when reading the
 * log: a suspension is a `member` row, so it does NOT appear under `הרשאות`,
 * which selects grant rows alone.
 */
export const AUDIT_FILTERS = [
  { value: 'all', label: 'הכול', objectType: undefined },
  { value: 'vote', label: 'הצעות', objectType: 'vote' },
  { value: 'grant', label: 'הרשאות', objectType: 'grant' },
  {
    value: 'notification_campaign',
    label: 'התראות',
    objectType: 'notification_campaign',
  },
] as const;

export type AuditFilterValue = (typeof AUDIT_FILTERS)[number]['value'];

export const DEFAULT_AUDIT_FILTER: AuditFilterValue = 'all';

export const isAuditFilter = (value: string | null): value is AuditFilterValue =>
  value !== null && AUDIT_FILTERS.some((filter) => filter.value === value);

/** Cursors are base64url, so `~` cannot occur inside one. */
const TRAIL_SEPARATOR = '~';

export const encodeTrail = (trail: readonly string[]): string =>
  trail.join(TRAIL_SEPARATOR);

export const decodeTrail = (raw: string | null): string[] =>
  raw ? raw.split(TRAIL_SEPARATOR).filter((part) => part.length > 0) : [];
