import React from 'react';
import { redirect } from 'next/navigation';
import { ErrorPanel, SpaceAdminHeader, SpaceAdminNav } from '@/components/space-admin';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import { listSpaceAudit } from '@/server/app/space-admin/list-audit';
import { getSessionFromCookies } from '@/services/auth/session';
import { AuditClient, type AuditSurfaceState } from './AuditClient';
import {
  AUDIT_FILTERS,
  DEFAULT_AUDIT_FILTER,
  decodeTrail,
  isAuditFilter,
  type AuditFilterValue,
} from './filters';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';

/**
 * Surface 6 - `/space-admin/{spaceId}/audit`.
 *
 * The page calls `listSpaceAudit`, the authorized use-case, which resolves
 * `audit.read` before it reaches anything. It does NOT call the repository
 * behind it: that function takes a `SpaceScope` this page cannot mint, and
 * reaching it would put a database read in front of no authorization at all.
 * The two carry different names for exactly that reason.
 *
 * Every filter and the cursor arrive from the query string and are handed back
 * to the client already applied, so the surface renders one page of one
 * filtered view and holds nothing it did not fetch.
 */

const HEADING_ID = 'space-admin-audit-heading';

const STANDFIRST =
  'היומן הוא רשומה בלתי ניתנת לשינוי. אי אפשר לערוך או למחוק ממנו רשומה - גם לא מנהל-על, וגם לא כשהרשאות מושעות.';

type SearchParams = Record<string, string | string[] | undefined>;

const readParam = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const objectTypeFor = (filter: AuditFilterValue) =>
  AUDIT_FILTERS.find((entry) => entry.value === filter)?.objectType;

interface AuditPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
  searchParams: Promise<SearchParams>;
}

export default async function SpaceAuditPage({ params, searchParams }: AuditPageProps) {
  const { locale, spaceId } = await params;
  const query = await searchParams;

  const session = await getSessionFromCookies();
  if (!session) redirect(`${localePrefix(locale)}/sign-in`);

  const requested = readParam(query.objectType);
  const filter: AuditFilterValue = isAuditFilter(requested)
    ? requested
    : DEFAULT_AUDIT_FILTER;
  const actor = readParam(query.actor);
  const cursor = readParam(query.cursor);
  const trail = decodeTrail(readParam(query.trail));

  // Shell identity and the capability set. A membership that does not resolve
  // is the same opaque refusal as a space that does not exist, and the space is
  // not named in it.
  const overview = await getSpaceOverview(session, spaceId);
  if (overview.isErr()) {
    return (
      <div className={styles.surface}>
        {overview.error.kind === 'FORBIDDEN' ? (
          <EscalationDialog spaceId={spaceId} trigger="no-permission" />
        ) : (
          <ErrorPanel />
        )}
      </div>
    );
  }

  const { space } = overview.value;

  const page = await listSpaceAudit(session, spaceId, {
    objectType: objectTypeFor(filter),
    // The use-case validates it; anything that is not a uuid is a client bug
    // and comes back as a 400 rather than as a page that quietly ignored it.
    ...(actor ? { actor } : {}),
    ...(cursor ? { cursor } : {}),
  });

  const state: AuditSurfaceState = page.isOk()
    ? {
        kind: 'ok',
        spaceName: space.nameHe,
        rows: page.value.rows,
        nextCursor: page.value.nextCursor,
        truncated: page.value.truncated,
      }
    : page.error.kind === 'FORBIDDEN'
      ? { kind: 'denied' }
      : { kind: 'failed' };

  return (
    <section className={styles.surface} aria-labelledby={HEADING_ID}>
      <SpaceAdminHeader
        spaceName={space.nameHe}
        spaceTypeLabel={spaceTypeLabel(space.type)}
        slug={space.slug}
        spaceId={space.id}
        suspended={space.suspended}
      />
      <SpaceAdminNav
        spaceId={space.id}
        active="audit"
        visibleHrefs={visibleNavHrefs(space.capabilities)}
        locale={locale}
      />

      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        יומן פעולות · AUDIT
      </span>

      <h2 id={HEADING_ID} className={styles.heading}>
        יומן פעולות
      </h2>

      <p className={styles.standfirst}>{STANDFIRST}</p>

      <AuditClient
        spaceId={space.id}
        locale={locale}
        filter={filter}
        actor={actor}
        cursor={cursor}
        trail={trail}
        state={state}
      />
    </section>
  );
}
