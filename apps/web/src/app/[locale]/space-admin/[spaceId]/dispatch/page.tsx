import React from 'react';
import { redirect } from 'next/navigation';
import { ErrorPanel, SpaceAdminHeader, SpaceAdminNav } from '@/components/space-admin';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import { listSentCampaigns } from '@/server/app/space-admin/send-notification';
import { getSessionFromCookies } from '@/services/auth/session';
import { DispatchClient } from './DispatchClient';
import styles from './page.module.css';

/**
 * Surface 5 — `/he/space-admin/{spaceId}/dispatch`.
 *
 * This page resolves its own authorization on every request, through the same
 * use-case the API routes call. `listSentCampaigns` is gated on
 * `notification.send`: the history is a record of what an admin did with that
 * capability, and there is no separate read capability for it — so a member
 * without it gets the refusal here rather than an empty list.
 *
 * It reaches no repository and opens no database client. A page is directly
 * addressable and runs with full server privileges, so its authorization has
 * to come from the same place the API's does, or the "swap the spaceId, get
 * FORBIDDEN" test would only be true of one of the two doors into the data.
 */

const HEADING_ID = 'space-admin-dispatch-heading';

const STANDFIRST =
  'ההתראה נשלחת לאפליקציה ולמכשירים של הנמענים. מי שביטל הסכמה לא יקבל אותה — גם אם הוא בקהל שבחרתם.';

const HISTORY_EMPTY = 'עוד לא נשלחה התראה מהמרחב הזה.';

interface DispatchPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
}

export default async function SpaceDispatchPage({ params }: DispatchPageProps) {
  const { locale, spaceId } = await params;

  const session = await getSessionFromCookies();
  if (!session) redirect(`/${locale}/sign-in`);

  // Shell identity and the capability set. A membership that does not resolve
  // is the same opaque refusal as a space that does not exist, and the space
  // is not named in it — an admin who holds nothing here must not learn its
  // name from the page that just refused them.
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
  const history = await listSentCampaigns(session, spaceId);

  const shell = (
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
        active="dispatch"
        visibleHrefs={visibleNavHrefs(space.capabilities)}
        locale={locale}
      />
      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        משגר · DISPATCH
      </span>
      <h2 id={HEADING_ID} className={styles.heading}>
        שליחת התראה לתושבי המרחב
      </h2>
      <p className={styles.standfirst}>{STANDFIRST}</p>
    </>
  );

  if (history.isErr()) {
    // A member here who holds no `notification.send`: the page stays coherent —
    // masthead, header, nav, footer — and the surface itself is the refusal,
    // with the escalation path on it.
    return (
      <section className={styles.surface} aria-labelledby={HEADING_ID}>
        {shell}
        {history.error.kind === 'FORBIDDEN' ? (
          <EscalationDialog spaceId={spaceId} trigger="no-permission" />
        ) : (
          <ErrorPanel />
        )}
      </section>
    );
  }

  const { campaigns, quota } = history.value;

  return (
    <section className={styles.surface} aria-labelledby={HEADING_ID}>
      {shell}

      <DispatchClient spaceId={space.id} quota={quota} />

      <div className={styles.history}>
        <h3 className={styles.historyHeading}>התראות שנשלחו</h3>
        {campaigns.length === 0 ? (
          <p className={styles.historyEmpty}>{HISTORY_EMPTY}</p>
        ) : (
          <ul className={styles.historyList}>
            {campaigns.map((campaign) => (
              <li key={campaign.id} className={styles.historyRow}>
                <span className={styles.historyTitle}>{campaign.title}</span>
                <span className={styles.historyMeta}>
                  {new Date(campaign.sentAt).toLocaleString('he-IL', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}{' '}
                  · {campaign.recipients} נמענים · {campaign.suppressed} הוחרגו
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
