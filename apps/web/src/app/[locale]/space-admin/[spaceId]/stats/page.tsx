/**
 * Surface 4 - נתונים מצטברים (aggregate-only statistics), SPACE-07.
 *
 * Four cards and a footer note is the whole surface, and that is the
 * specification rather than a shortfall: CONTEXT.md defers the richer
 * statistics dashboard to issue #91, and what SPACE-07 needs here is a surface
 * that proves the aggregates-only promise. A breakdown, a filter or a time
 * series would not be a bonus - they are the things this surface exists to
 * refuse.
 *
 * Nothing on it is interactive. It is a Server Component with no client code
 * in the happy path at all, which is the structural reason no figure can
 * acquire a click handler by accident. Forbidden here, exhaustively: a
 * clickable card, an anchor or control wrapping a figure, a hover state on a
 * figure, a chevron or arrow glyph on a card, a "see the breakdown"
 * affordance, any per-resident row, any name, any identifying attribute, any
 * map pin, any export control.
 *
 * THE THREE STATUSES ARE THREE DIFFERENT CLAIMS AND MUST STAY VISIBLY
 * DISTINCT:
 *
 *   available   → the number itself. A measured zero prints `0`.
 *   suppressed  → `<5`. The claim is "fewer than five people". The true small
 *                 number never reached this process; the API replaced it.
 *   unavailable → an em dash. The claim is "we are not telling you this".
 *
 * Printing an unavailable figure as `<5` would re-assert a bound the server
 * deliberately withheld. Printing a suppressed one as an em dash would throw
 * away information the admin is entitled to. Neither is a display preference.
 *
 * One consequence worth knowing before touching the renderer: 05-07 withholds
 * `participationRate` as `unavailable`, never as `suppressed`, because a rate
 * times a published denominator recovers a suppressed numerator - and because
 * `<5` on a percentage card asserts "under five percent", a different and
 * possibly false claim. This renderer treats all four cards identically on
 * purpose. If a future change ever marks the rate suppressed, the fix belongs
 * in the SQL and the mapping, not in a special case here.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import type { SpaceMetric } from '@sync/shared/contracts';
import { SpaceAdminHeader, SpaceAdminNav } from '@/components/space-admin';
import { spaceTypeLabel, visibleNavHrefs } from '@/components/space-admin/chrome';
import kicker from '@/components/space-admin/kicker.module.css';
import type { Locale } from '@/lib/i18n';
import { getSpaceMetrics } from '@/server/app/space-admin/get-metrics';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';
import { getSessionFromCookies } from '@/services/auth/session';
import { StatsFallback } from './StatsFallback';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';

/**
 * The suppressed figure is a literal string, not a computed bound. The client
 * never learns the number it stands for.
 */
const SUPPRESSED_FIGURE = '<5';
const SUPPRESSED_NOTE = 'מוסתר - קבוצה קטנה מדי';

const UNAVAILABLE_FIGURE = '-';
const UNAVAILABLE_NOTE = 'הנתון לא זמין';

/**
 * A missing figure is treated as withheld, never as zero. `space_admin_metrics`
 * returns no row at all for a space it cannot resolve, and the use-case folds
 * that into four withheld figures - but the guard stays here too, because a
 * fabricated zero is indistinguishable from a measured one and that is the
 * exact mistake this surface exists to avoid.
 */
const WITHHELD: SpaceMetric = { value: null, status: 'unavailable' };

interface StatCardProps {
  label: string;
  metric: SpaceMetric | undefined;
  /** Rendered after the number. Used by the participation-rate card. */
  suffix?: string;
}

function StatCard({ label, metric, suffix }: StatCardProps) {
  const resolved = metric ?? WITHHELD;

  if (resolved.status === 'suppressed') {
    return (
      <div className={styles.statCard}>
        <span className={styles.statLabel}>{label}</span>
        {/* LTR-isolated: in an RTL paragraph the less-than sign mirrors and
            moves, so an un-isolated suppressed figure reads back to front. */}
        <span dir="ltr" className={styles.statSuppressed}>
          {SUPPRESSED_FIGURE}
        </span>
        <span className={styles.statNote}>{SUPPRESSED_NOTE}</span>
      </div>
    );
  }

  if (resolved.status === 'available' && resolved.value !== null) {
    return (
      <div className={styles.statCard}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statFigure}>
          {resolved.value.toLocaleString('he-IL')}
          {suffix}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statUnavailable}>{UNAVAILABLE_FIGURE}</span>
      <span className={styles.statNote}>{UNAVAILABLE_NOTE}</span>
    </div>
  );
}

const FOOTER_NOTE_HE =
  'כל המספרים כאן מצטברים. אין בלוח הזה פילוח או צפייה ברמת תושב יחיד - לא במסך ולא ב־API שמאחוריו.';

interface SpaceStatsPageProps {
  params: Promise<{ locale: Locale; spaceId: string }>;
}

export default async function SpaceStatsPage({ params }: SpaceStatsPageProps) {
  const { locale, spaceId } = await params;

  const session = await getSessionFromCookies();
  if (!session) redirect(`${localePrefix(locale)}/sign-in`);

  const overview = await getSpaceOverview(session, spaceId);

  // No membership at all: no space identity to caption, so the panel stands
  // alone inside the shell rather than under a header naming a space the
  // viewer has not been told exists.
  if (overview.isErr()) {
    return <StatsFallback kind="denied" spaceId={spaceId} />;
  }

  const { space } = overview.value;
  const metrics = await getSpaceMetrics(session, spaceId);

  const header = (
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
        active="stats"
        visibleHrefs={visibleNavHrefs(space.capabilities)}
        locale={locale}
      />
    </>
  );

  if (metrics.isErr()) {
    return (
      <>
        {header}
        <section className={styles.surface} aria-labelledby="space-stats-heading">
          <span className={kicker.kicker}>
            <span aria-hidden className={kicker.tick}>
              ■
            </span>
            נתונים מצטברים · AGGREGATES
          </span>
          <h2 id="space-stats-heading" className={styles.heading}>
            נתונים מצטברים
          </h2>
          <StatsFallback
            kind={metrics.error.kind === 'FORBIDDEN' ? 'denied' : 'error'}
            spaceId={space.id}
          />
          <p className={styles.footerNote}>{FOOTER_NOTE_HE}</p>
        </section>
      </>
    );
  }

  const figures = metrics.value;

  return (
    <>
      {header}
      <section className={styles.surface} aria-labelledby="space-stats-heading">
        <span className={kicker.kicker}>
          <span aria-hidden className={kicker.tick}>
            ■
          </span>
          נתונים מצטברים · AGGREGATES
        </span>

        <h2 id="space-stats-heading" className={styles.heading}>
          נתונים מצטברים
        </h2>

        <p className={styles.standfirst}>
          תמונת מצב של המרחב במספרים. הכול מצטבר - אין כאן תושב יחיד.
        </p>

        <div className={styles.grid}>
          <StatCard
            label="תושבים רשומים במרחב"
            metric={figures.registeredResidents}
          />
          <StatCard
            label="משתתפים פעילים (30 יום)"
            metric={figures.activeParticipants30d}
          />
          <StatCard label="הצעות שהוגשו" metric={figures.proposalsSubmitted} />
          <StatCard
            label="שיעור השתתפות"
            metric={figures.participationRate}
            suffix="%"
          />
        </div>

        <p className={styles.footerNote}>{FOOTER_NOTE_HE}</p>
      </section>
    </>
  );
}
