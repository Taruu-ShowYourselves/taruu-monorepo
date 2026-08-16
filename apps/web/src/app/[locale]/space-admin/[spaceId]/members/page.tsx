/**
 * Surface 3 - חברים והרשאות (members and roles).
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
 * authorization at all - which is exactly why the two carry different names.
 *
 * The privacy note under the standfirst is not decoration: it is this
 * surface's statement of the SPACE-07 promise, and it is rendered as visible
 * text rather than a tooltip or a comment.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import type { Result } from 'neverthrow';
import type { SpaceMemberListResponse } from '@sync/shared/contracts';
import { SpaceAdminHeader, SpaceAdminNav } from '@/components/space-admin';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceMembers } from '@/server/app/space-admin/list-members';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import type { Capability } from '@/server/domain/space/capability';
import type { AppError } from '@/server/http/errors';
import { getSessionFromCookies } from '@/services/auth/session';
import { MembersClient, type MembersSurfaceState } from './MembersClient';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';

interface MembersPageCopy {
  kicker: string;
  heading: string;
  standfirst: string;
  privacyNote: string;
}

const COPY: Record<Locale, MembersPageCopy> = {
  he: {
    kicker: 'חברים והרשאות · MEMBERS',
    heading: 'חברים והרשאות',
    standfirst:
      'רשימת החברים במרחב הזה בלבד, עם הפרטים הדרושים לניהול - ולא יותר מזה.',
    privacyNote:
      'מוצגים רק פרטים הנדרשים לניהול. מסמכי זהות אינם נגישים מלוח זה, בשום מסך ובשום ייצוא.',
  },
  en: {
    kicker: 'Members and roles · MEMBERS',
    heading: 'Members and roles',
    standfirst:
      'The members of this space only, with the details administration requires - and nothing more.',
    privacyNote:
      'Only details required for administration are shown. Identity documents cannot be reached from this desk - on any screen, in any export.',
  },
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
  const t = COPY[locale];
  const query = await searchParams;
  const rawSearch = query.search;
  const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';

  const session = await getSessionFromCookies();
  if (!session) redirect(`${localePrefix(locale)}/sign-in`);

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
        spaceTypeLabel={spaceTypeLabel(space.type)}
        slug={space.slug}
        spaceId={space.id}
        suspended={space.suspended}
      />

      <SpaceAdminNav
        spaceId={space.id}
        active="members"
        visibleHrefs={visibleNavHrefs(space.capabilities)}
        locale={locale}
      />

      <section className={styles.surface} aria-labelledby="space-members-heading">
        <span className={kicker.kicker}>
          <span aria-hidden className={kicker.tick}>
            ■
          </span>
          {t.kicker}
        </span>

        <h2 id="space-members-heading" className={styles.heading}>
          {t.heading}
        </h2>

        <p className={styles.standfirst}>{t.standfirst}</p>

        <p className={styles.privacyNote}>{t.privacyNote}</p>

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
