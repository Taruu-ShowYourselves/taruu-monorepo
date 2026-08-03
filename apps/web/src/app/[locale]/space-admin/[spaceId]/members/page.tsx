/**
 * Surface 3 — חברים והרשאות (members and roles).
 *
 * A Server Component that resolves its own authority on every request. The
 * shell (space identity + the capability set that drives Rule A) comes from
 * `getSpaceOverview`, which resolves *membership*; the table data comes from
 * `getSpaceMembers`, which resolves the `member.read` capability separately.
 * Two independent checks, which is what makes the "swap the spaceId, get
 * FORBIDDEN" test apply to this surface on its own.
 *
 * `getSpaceMembers` is the authorized read and the only one this page may
 * reach for. The repository entry point behind it takes a `SpaceScope` this
 * page cannot mint, and importing it would put a database call in front of no
 * authorization at all — which is exactly why the two carry different names.
 *
 * The privacy note under the standfirst is not decoration: it is this
 * surface's statement of the SPACE-07 promise, and it is rendered as visible
 * text rather than a tooltip or a comment.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import type { Result } from 'neverthrow';
import type { SpaceMemberListResponse } from '@sync/shared/contracts';
import {
  SpaceAdminHeader,
  SpaceAdminNav,
  type SpaceAdminNavHref,
} from '@/components/space-admin';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceMembers } from '@/server/app/space-admin/list-members';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import type { Capability } from '@/server/domain/space/capability';
import type { AppError } from '@/server/http/errors';
import { getSessionFromCookies } from '@/services/auth/session';
import { MembersClient, type MembersSurfaceState } from './MembersClient';
import styles from './page.module.css';

/**
 * Which capability opens which surface. Duplicated on the statistics surface
 * in this same plan and, most likely, on the four other surfaces of this
 * phase — deliberately inlined rather than extracted, because 05-12 runs
 * concurrently and is the plan authorized to create a shared module this
 * wave. 05-15 dedupes.
 */
const SURFACE_CAPABILITY: Readonly<Record<string, Capability>> = {
  proposals: 'proposal.read',
  members: 'member.read',
  stats: 'metrics.read',
  dispatch: 'notification.send',
  audit: 'audit.read',
};

const NAV_ORDER: readonly SpaceAdminNavHref[] = [
  '',
  'proposals',
  'members',
  'stats',
  'dispatch',
  'audit',
];

/** Rule A: a surface the admin holds nothing for gets no nav link at all. */
const visibleSurfaces = (
  capabilities: readonly Capability[]
): readonly SpaceAdminNavHref[] => {
  const held = new Set<Capability>(capabilities);
  return NAV_ORDER.filter((href) => {
    if (href === '') return true;
    const required = SURFACE_CAPABILITY[href];
    return required !== undefined && held.has(required);
  });
};

/**
 * Hebrew for the five values the `spaces.type` CHECK admits today. Also
 * duplicated on the statistics surface for the same reason as the map above.
 * Unknown values fall through to the stored string rather than to a guess.
 */
const SPACE_TYPE_LABELS_HE: Readonly<Record<string, string>> = {
  municipality: 'רשות מקומית',
  national: 'מרחב ארצי',
  organization: 'ארגון',
  urban_area: 'אזור עירוני',
  nationwide_civic: 'מרחב אזרחי ארצי',
};

const toSurfaceState = (
  spaceName: string,
  result: Result<SpaceMemberListResponse, AppError>
): MembersSurfaceState => {
  if (result.isOk()) {
    return {
      kind: 'ok',
      spaceName,
      members: result.value.members,
      total: result.value.total,
    };
  }
  return result.error.kind === 'FORBIDDEN' ? { kind: 'denied' } : { kind: 'failed' };
};

interface SpaceMembersPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SpaceMembersPage({
  params,
  searchParams,
}: SpaceMembersPageProps) {
  const { locale, spaceId } = await params;
  const query = await searchParams;
  const rawSearch = query.search;
  const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';

  const session = await getSessionFromCookies();
  if (!session) redirect(`/${locale}/sign-in`);

  const overview = await getSpaceOverview(session, spaceId);

  // No membership at all: there is no space identity to print above the panel,
  // and printing one would be the disclosure the opaque denial exists to avoid.
  if (overview.isErr()) {
    return (
      <MembersClient
        spaceId={spaceId}
        search=""
        canGrant={false}
        canRevoke={false}
        canSuspend={false}
        state={{ kind: 'denied' }}
      />
    );
  }

  const { space } = overview.value;
  const held = new Set<Capability>(space.capabilities);

  const members = await getSpaceMembers(
    session,
    spaceId,
    search ? { search } : {}
  );

  return (
    <>
      <SpaceAdminHeader
        spaceName={space.nameHe}
        spaceTypeLabel={SPACE_TYPE_LABELS_HE[space.type] ?? space.type}
        slug={space.slug}
        spaceId={space.id}
        suspended={space.suspended}
      />

      <SpaceAdminNav
        spaceId={space.id}
        active="members"
        visibleHrefs={visibleSurfaces(space.capabilities)}
        locale={locale}
      />

      <section className={styles.surface} aria-labelledby="space-members-heading">
        <span className={kicker.kicker}>
          <span aria-hidden className={kicker.tick}>
            ■
          </span>
          חברים והרשאות · MEMBERS
        </span>

        <h2 id="space-members-heading" className={styles.heading}>
          חברים והרשאות
        </h2>

        <p className={styles.standfirst}>
          רשימת החברים במרחב הזה בלבד, עם הפרטים הדרושים לניהול — ולא יותר מזה.
        </p>

        <p className={styles.privacyNote}>
          מוצגים רק פרטים הנדרשים לניהול. מסמכי זהות אינם נגישים מלוח זה, בשום
          מסך ובשום ייצוא.
        </p>

        <MembersClient
          spaceId={space.id}
          search={search}
          canGrant={held.has('grant.create')}
          canRevoke={held.has('grant.revoke')}
          canSuspend={held.has('member.suspend')}
          state={toSurfaceState(space.nameHe, members)}
        />
      </section>
    </>
  );
}
