import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NewsButton } from '@/components/press/NewsButton';
import {
  ClampedText,
  ErrorPanel,
  SpaceAdminHeader,
  SpaceAdminNav,
  StatusChip,
} from '@/components/space-admin';
import { CapabilityManifest } from '@/components/space-admin/CapabilityManifest';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import { getSessionFromCookies } from '@/services/auth/session';
import styles from './page.module.css';

/**
 * Surface 1 — סקירה, the space overview.
 *
 * A Server Component that calls `getSpaceOverview`, THE SAME USE-CASE THE API
 * ROUTE CALLS. It reaches no repository and opens no database client of its
 * own: a page is directly addressable and runs with full server privileges, so
 * its authorization has to come from the same place the API's does, or the
 * SPACE-03 test ("swap the spaceId, get FORBIDDEN") would only be true of one
 * of the two doors into the same data.
 *
 * Rule A governs what renders: a figure the admin holds no capability for
 * arrives as `null` and is ABSENT — never a zero, never a dash. The capability
 * manifest below is what keeps that from being mysterious.
 */

export const metadata: Metadata = {
  // The locale layout supplies the `| תַּרְאוּ` half through its title template;
  // repeating it here renders the suffix twice.
  title: 'לוח ניהול מרחב',
  // An admin console has nothing to gain from being indexed.
  robots: { index: false, follow: false },
};

/** Copy-deck strings, each on one line so it stays one greppable literal. */
const STANDFIRST =
  'כל מה שדורש את ההכרעה שלכם במרחב הזה, במקום אחד. כל פעולה שתעשו כאן נרשמת ביומן עם שמכם ועם הנימוק.';
const QUEUE_EMPTY = 'אין כרגע הצעות שממתינות להכרעה.';
const ESCALATION_BODY =
  'נתקלתם במשהו שחורג מההרשאות שלכם, או במקרה שדורש מנהל־על?';

interface SpaceOverviewPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
}

export default async function SpaceOverviewPage({ params }: SpaceOverviewPageProps) {
  const { locale, spaceId } = await params;
  const base = `/${locale}/space-admin/${spaceId}`;

  const session = await getSessionFromCookies();
  if (!session) redirect(`/${locale}/sign-in?redirect=${encodeURIComponent(base)}`);

  const result = await getSpaceOverview(session, spaceId);

  if (result.isErr()) {
    if (result.error.kind === 'UNAUTHORIZED') {
      redirect(`/${locale}/sign-in?redirect=${encodeURIComponent(base)}`);
    }

    // Refused: NoPermissionPanel — rendered by EscalationDialog, which owns the
    // CTA it needs — and deliberately NO SpaceAdminHeader and no nav. An admin
    // who holds nothing here must not learn the space's name, its slug or its
    // type from the page that just refused them, and links to five surfaces
    // they cannot open would be a menu of denials.
    if (result.error.kind === 'FORBIDDEN') {
      return <EscalationDialog spaceId={spaceId} trigger="no-permission" />;
    }

    // Everything else is a real failure. There is one use-case call behind this
    // surface, so there is nothing to retry per panel and no handler to pass
    // from a Server Component; ErrorPanel renders without a CTA by design.
    return <ErrorPanel />;
  }

  const { space, capabilities, figures, recentQueue } = result.value;

  const shownFigures = [
    { key: 'awaiting', label: 'הצעות ממתינות להכרעה', value: figures.proposalsAwaitingDecision },
    { key: 'members', label: 'חברים במרחב', value: figures.membersInSpace },
    { key: 'active', label: 'הצבעות פעילות', value: figures.activeVotes },
    { key: 'notifications', label: 'התראות שנשלחו החודש', value: figures.notificationsSentThisMonth },
  ].filter((figure): figure is { key: string; label: string; value: number } =>
    figure.value !== null
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

      <SpaceAdminNav spaceId={spaceId} active="" visibleHrefs={visibleNavHrefs(capabilities)} />

      <p className={styles.standfirst}>{STANDFIRST}</p>

      {/* A figure the admin may not see is absent. Rendering a 0 in its place
          would be a fabricated measurement, and a dash would imply the number
          exists and could not be fetched. */}
      {shownFigures.length > 0 ? (
        <ul className={styles.figures}>
          {shownFigures.map((figure) => (
            <li key={figure.key} className={styles.figureCard}>
              <span className={styles.figureLabel}>{figure.label}</span>
              <span className={styles.figureValue}>
                {figure.value.toLocaleString('he-IL')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.split}>
        {recentQueue !== null ? (
          <section className={styles.panel} aria-labelledby="space-admin-queue">
            <span className={kicker.kicker}>
              <span aria-hidden className={kicker.tick}>
                ■
              </span>
              תור הכרעה · REVIEW QUEUE
            </span>
            <h2 id="space-admin-queue" className={styles.panelHeading}>
              דורש הכרעה
            </h2>

            {recentQueue.length > 0 ? (
              <ul className={styles.queue}>
                {recentQueue.map((proposal) => (
                  <li key={proposal.id} className={styles.queueRow}>
                    <span className={styles.queueTitle}>
                      <ClampedText lines={2} title={proposal.title}>
                        {proposal.title}
                      </ClampedText>
                    </span>
                    {/* The use-case fixes this queue to proposals in review, so
                        every row carries the one chip that means "yours to
                        decide". Nothing else can arrive here. */}
                    <StatusChip tone="review">בבדיקה</StatusChip>
                    <span className={styles.queueMeta}>
                      {proposal.submitterDisplayName} ·{' '}
                      {new Date(proposal.submittedAt).toLocaleDateString('he-IL')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.queueEmpty}>{QUEUE_EMPTY}</p>
            )}

            <div className={styles.panelActions}>
              {/* Renders `לכל ההצעות ←`. The arrow goes through `trailing`,
                  which marks it aria-hidden — a glyph never carries meaning. */}
              <NewsButton variant="outline" href={`${base}/proposals`} trailing="←">
                לכל ההצעות
              </NewsButton>
            </div>
          </section>
        ) : null}

        <div className={styles.aside}>
          <section className={styles.panel} aria-labelledby="space-admin-manifest">
            <span className={kicker.kicker}>
              <span aria-hidden className={kicker.tick}>
                ■
              </span>
              ההרשאות שלכם · CAPABILITIES
            </span>
            <h2 id="space-admin-manifest" className={styles.panelHeading}>
              מה מותר לכם לעשות במרחב הזה
            </h2>
            <CapabilityManifest granted={capabilities} />
          </section>

          <section className={styles.panel} aria-labelledby="space-admin-escalation">
            <span className={kicker.kicker}>
              <span aria-hidden className={kicker.tick}>
                ■
              </span>
              הסלמה · ESCALATION
            </span>
            <h2 id="space-admin-escalation" className={styles.panelHeading}>
              פנייה למנהל־על
            </h2>
            <p className={styles.panelBody}>{ESCALATION_BODY}</p>
            <EscalationDialog spaceId={spaceId} />
          </section>
        </div>
      </div>
    </>
  );
}
