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
import { localePrefix } from '@/lib/i18n';

/**
 * Surface 5 - `/space-admin/{spaceId}/dispatch`.
 *
 * This page resolves its own authorization on every request, through the same
 * use-case the API routes call. `listSentCampaigns` is gated on
 * `notification.send`: the history is a record of what an admin did with that
 * capability, and there is no separate read capability for it - so a member
 * without it gets the refusal here rather than an empty list.
 *
 * It reaches no repository and opens no database client. A page is directly
 * addressable and runs with full server privileges, so its authorization has
 * to come from the same place the API's does, or the "swap the spaceId, get
 * FORBIDDEN" test would only be true of one of the two doors into the data.
 */

const HEADING_ID = 'space-admin-dispatch-heading';

interface DispatchPageCopy {
  kicker: string;
  heading: string;
  standfirst: string;
  historyHeading: string;
  historyEmpty: string;
  recipientsLabel: string;
  suppressedLabel: string;
  /** BCP 47 tag for the sent-at timestamp on each history row. */
  dateLocale: string;
}

const COPY: Record<Locale, DispatchPageCopy> = {
  he: {
    kicker: 'משגר · DISPATCH',
    heading: 'שליחת התראה לתושבי המרחב',
    standfirst:
      'ההתראה נשלחת לאפליקציה ולמכשירים של הנמענים. מי שביטל הסכמה לא יקבל אותה - גם אם הוא בקהל שבחרתם.',
    historyHeading: 'התראות שנשלחו',
    historyEmpty: 'עוד לא נשלחה התראה מהמרחב הזה.',
    recipientsLabel: 'נמענים',
    suppressedLabel: 'הוחרגו',
    dateLocale: 'he-IL',
  },
  en: {
    kicker: 'Dispatch desk · DISPATCH',
    heading: "Send a notification to this space's residents",
    standfirst:
      "The notification goes to recipients' app and devices. Anyone who has withdrawn consent will not receive it - even if they are in the audience you selected.",
    historyHeading: 'Notifications sent',
    historyEmpty: 'No notification has been sent from this space yet.',
    recipientsLabel: 'recipients',
    suppressedLabel: 'suppressed',
    dateLocale: 'en-GB',
  },
};

interface DispatchPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
}

export default async function SpaceDispatchPage({ params }: DispatchPageProps) {
  const { locale, spaceId } = await params;
  const t = COPY[locale];

  const session = await getSessionFromCookies();
  if (!session) redirect(`${localePrefix(locale)}/sign-in`);

  // Shell identity and the capability set. A membership that does not resolve
  // is the same opaque refusal as a space that does not exist, and the space
  // is not named in it - an admin who holds nothing here must not learn its
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
        {t.kicker}
      </span>
      <h2 id={HEADING_ID} className={styles.heading}>
        {t.heading}
      </h2>
      <p className={styles.standfirst}>{t.standfirst}</p>
    </>
  );

  if (history.isErr()) {
    // A member here who holds no `notification.send`: the page stays coherent -
    // masthead, header, nav, footer - and the surface itself is the refusal,
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
        <h3 className={styles.historyHeading}>{t.historyHeading}</h3>
        {campaigns.length === 0 ? (
          <p className={styles.historyEmpty}>{t.historyEmpty}</p>
        ) : (
          <ul className={styles.historyList}>
            {campaigns.map((campaign) => (
              <li key={campaign.id} className={styles.historyRow}>
                <span className={styles.historyTitle}>{campaign.title}</span>
                <span className={styles.historyMeta}>
                  {new Date(campaign.sentAt).toLocaleString(t.dateLocale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}{' '}
                  · {campaign.recipients} {t.recipientsLabel} · {campaign.suppressed}{' '}
                  {t.suppressedLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
