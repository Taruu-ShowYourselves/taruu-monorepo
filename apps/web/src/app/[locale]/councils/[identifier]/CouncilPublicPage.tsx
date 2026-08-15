'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  CouncilMetric,
  PublicCouncilProfile,
} from '@sync/shared/contracts';
import type { Locale } from '@/lib/i18n';
import { localePath } from '@/lib/i18n';
import styles from './page.module.css';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; profile: PublicCouncilProfile };

interface CouncilCopy {
  /** One label per metric the contract returns. */
  labels: Record<MetricKey, string>;
  statusStale: string;
  statusUnavailable: string;
  statusFresh: string;
  unavailableCopy: string;
  definitionSummary: string;
  sourcePrefix: string;
  asOf: string;
  updated: string;
  noSource: string;
  eyebrow: string;
  loadingAria: string;
  backHome: string;
  notFoundTitle: string;
  notFoundBody: string;
  errorTitle: string;
  errorBody: string;
  intro: string;
  generatedAt: (date: string) => string;
  metricsAria: string;
  emptyAria: string;
  emptyTitle: string;
  emptyBody: string;
  linksAria: string;
  allVotes: string;
  civicSpace: string;
  privacyAria: string;
  privacyTitle: string;
  privacyBody: string;
  /** BCP 47 tag for the counts and the source dates. */
  dateLocale: string;
}

type MetricKey =
  | 'officialPopulation'
  | 'registeredUsers'
  | 'communityManagers'
  | 'payingUsers'
  | 'relevantVotes'
  | 'activeVotes';

const COPY: Record<Locale, CouncilCopy> = {
  he: {
    labels: {
      officialPopulation: 'אוכלוסייה רשמית',
      registeredUsers: 'משתמשים רשומים',
      communityManagers: 'מנהלי קהילה',
      payingUsers: 'משתמשים משלמים',
      relevantVotes: 'הצבעות רלוונטיות',
      activeVotes: 'הצבעות פעילות',
    },
    statusStale: 'דורש רענון',
    statusUnavailable: 'לא זמין',
    statusFresh: 'מעודכן',
    unavailableCopy: 'הנתון יופיע לאחר אימות המקור.',
    definitionSummary: 'איך הנתון מחושב?',
    sourcePrefix: 'מקור: ',
    asOf: 'נכון ל-',
    updated: 'עודכן ',
    noSource: 'מקור מלא טרם פורסם.',
    eyebrow: 'פרופיל מועצה · COUNCIL',
    loadingAria: 'טוען נתוני מועצה',
    backHome: 'חזרה לעמוד הראשי',
    notFoundTitle: 'המועצה לא נמצאה',
    notFoundBody: 'לא מצאנו מועצה ציבורית שמתאימה לכתובת הזו.',
    errorTitle: 'הנתונים אינם זמינים כרגע',
    errorBody:
      'לא הצלחנו לטעון את נתוני המועצה. אפשר לנסות שוב בעוד כמה דקות.',
    intro:
      'תמונה ציבורית של האוכלוסייה הרשמית והקהילה הפעילה בתַּרְאוּ. הנתונים מצרפיים בלבד - ללא פרטים על אנשים.',
    generatedAt: (date) => `תמונת מצב נוצרה ב-${date}`,
    metricsAria: 'מדדי המועצה',
    emptyAria: 'מועצה ללא פעילות',
    emptyTitle: 'הקהילה המקומית עוד לא התחילה לפעול',
    emptyBody:
      'זו אינה שגיאה: כרגע אין משתמשים, מנהלים או הצבעות משויכים למועצה בתַּרְאוּ.',
    linksAria: 'קישורי מועצה',
    allVotes: 'לכל ההצבעות במועצה',
    civicSpace: 'למרחב האזרחי הקיים',
    privacyAria: 'הערת פרטיות',
    privacyTitle: 'שקיפות בלי חשיפה.',
    privacyBody:
      'העמוד מציג ספירות ומקורות בלבד. שמות, כתובות, פרטי זיהוי ופרטי תשלום אינם נכללים בתגובה הציבורית.',
    dateLocale: 'he-IL',
  },
  en: {
    labels: {
      officialPopulation: 'Official population',
      registeredUsers: 'Registered users',
      communityManagers: 'Community managers',
      payingUsers: 'Paying users',
      relevantVotes: 'Relevant votes',
      activeVotes: 'Active votes',
    },
    statusStale: 'Needs refresh',
    statusUnavailable: 'Unavailable',
    statusFresh: 'Current',
    unavailableCopy: 'The figure appears once its source is verified.',
    definitionSummary: 'How is this figure calculated?',
    sourcePrefix: 'Source: ',
    asOf: 'as of ',
    updated: 'updated ',
    noSource: 'A full source has not been published yet.',
    eyebrow: 'COUNCIL PROFILE',
    loadingAria: 'Loading council figures',
    backHome: 'Back to the front page',
    notFoundTitle: 'Council not found',
    notFoundBody: 'We found no public council matching this address.',
    errorTitle: 'The figures are unavailable right now',
    errorBody:
      'We could not load the council figures. Try again in a few minutes.',
    intro:
      "A public picture of the official population and the active community on Taruu. The figures are aggregate only - no details about individuals.",
    generatedAt: (date) => `Snapshot generated on ${date}`,
    metricsAria: 'Council metrics',
    emptyAria: 'Council with no activity',
    emptyTitle: 'The local community has not started yet',
    emptyBody:
      'This is not an error: no users, managers or votes are attached to this council on Taruu right now.',
    linksAria: 'Council links',
    allVotes: "To all the council's votes",
    civicSpace: 'To the existing civic space',
    privacyAria: 'Privacy note',
    privacyTitle: 'Transparency without exposure.',
    privacyBody:
      'This page shows counts and sources only. Names, addresses, identifying details and payment details are not part of the public response.',
    dateLocale: 'en-GB',
  },
};

function dateFormatter(t: CouncilCopy) {
  return new Intl.DateTimeFormat(t.dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });
}

function formatDate(t: CouncilCopy, value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter(t).format(date);
}

function MetricCard({
  metric,
  label,
  t,
}: {
  metric: CouncilMetric;
  label: string;
  t: CouncilCopy;
}) {
  const stateLabel =
    metric.status === 'stale'
      ? t.statusStale
      : metric.status === 'unavailable'
        ? t.statusUnavailable
        : t.statusFresh;

  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTopline}>
        <h2>{label}</h2>
        <span className={styles[metric.status]}>{stateLabel}</span>
      </div>
      <p className={styles.metricValue}>
        {metric.value === null
          ? '-'
          : new Intl.NumberFormat(t.dateLocale).format(metric.value)}
      </p>
      {metric.status === 'unavailable' ? (
        <p className={styles.unavailableCopy}>{t.unavailableCopy}</p>
      ) : null}
      <details className={styles.definition}>
        <summary>{t.definitionSummary}</summary>
        <p>{metric.definition}</p>
      </details>
      {metric.source ? (
        <div className={styles.source}>
          <span>{t.sourcePrefix}</span>
          {metric.source.url ? (
            <a
              href={metric.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {metric.source.name}
            </a>
          ) : (
            <span>{metric.source.name}</span>
          )}
          <span>
            {' · '}
            {t.asOf}
            {formatDate(t, metric.source.asOf)}
          </span>
          <span>
            {' · '}
            {t.updated}
            {formatDate(t, metric.source.updatedAt)}
          </span>
        </div>
      ) : (
        <p className={styles.source}>{t.noSource}</p>
      )}
    </article>
  );
}

function LoadingState({ locale, t }: { locale: Locale; t: CouncilCopy }) {
  return (
    <main
      className={styles.shell}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      aria-busy="true"
      aria-label={t.loadingAria}
    >
      <p className={styles.eyebrow}>{t.eyebrow}</p>
      <div className={styles.loadingTitle} />
      <div className={styles.metricsGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <div className={styles.loadingCard} key={index} />
        ))}
      </div>
    </main>
  );
}

function MessageState({
  title,
  children,
  locale,
  t,
}: {
  title: string;
  children: React.ReactNode;
  locale: Locale;
  t: CouncilCopy;
}) {
  return (
    <main className={styles.shell} dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <section className={styles.message} role="status">
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
        <Link href={localePath(locale)}>{t.backHome}</Link>
      </section>
    </main>
  );
}

export function CouncilPublicPage({
  identifier,
  locale,
}: {
  identifier: string;
  locale: string;
}) {
  const edition: Locale = locale === 'en' ? 'en' : 'he';
  const t = COPY[edition];
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/councils/${encodeURIComponent(identifier)}`,
          { signal: controller.signal }
        );
        if (response.status === 404) {
          setState({ kind: 'not-found' });
          return;
        }
        if (!response.ok) throw new Error(`Council API returned ${response.status}`);

        const profile = (await response.json()) as PublicCouncilProfile;
        setState({ kind: 'ready', profile });

        const currentPath = decodeURI(window.location.pathname);
        if (currentPath !== profile.council.canonicalUrl) {
          router.replace(profile.council.canonicalUrl);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setState({ kind: 'error' });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [identifier, locale, router]);

  if (state.kind === 'loading') return <LoadingState locale={edition} t={t} />;
  if (state.kind === 'not-found') {
    return (
      <MessageState title={t.notFoundTitle} locale={edition} t={t}>
        {t.notFoundBody}
      </MessageState>
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageState title={t.errorTitle} locale={edition} t={t}>
        {t.errorBody}
      </MessageState>
    );
  }

  const { profile } = state;
  const metrics = Object.entries(profile.metrics) as [MetricKey, CouncilMetric][];

  return (
    <main className={styles.shell} dir={edition === 'he' ? 'rtl' : 'ltr'}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{profile.council.name}</h1>
        <p className={styles.intro}>{t.intro}</p>
        <p className={styles.generated}>
          {t.generatedAt(formatDate(t, profile.generatedAt))}
        </p>
      </header>

      <section className={styles.metricsGrid} aria-label={t.metricsAria}>
        {metrics.map(([key, metric]) => (
          <MetricCard key={key} label={t.labels[key]} metric={metric} t={t} />
        ))}
      </section>

      {profile.metrics.registeredUsers.value === 0 &&
      profile.metrics.communityManagers.value === 0 &&
      profile.metrics.relevantVotes.value === 0 ? (
        <section className={styles.empty} aria-label={t.emptyAria}>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </section>
      ) : null}

      <nav className={styles.actions} aria-label={t.linksAria}>
        <Link href={profile.links.votes}>{t.allVotes}</Link>
        <Link href={profile.links.civicSpace}>{t.civicSpace}</Link>
      </nav>

      <aside className={styles.privacy} aria-label={t.privacyAria}>
        <strong>{t.privacyTitle}</strong>
        <span>{t.privacyBody}</span>
      </aside>
    </main>
  );
}
