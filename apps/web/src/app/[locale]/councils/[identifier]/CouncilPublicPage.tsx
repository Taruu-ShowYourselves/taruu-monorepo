'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  CouncilMetric,
  PublicCouncilProfile,
} from '@sync/shared/contracts';
import styles from './page.module.css';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; profile: PublicCouncilProfile };

const labels = {
  officialPopulation: 'אוכלוסייה רשמית',
  registeredUsers: 'משתמשים רשומים',
  communityManagers: 'מנהלי קהילה',
  payingUsers: 'משתמשים משלמים',
  relevantVotes: 'הצבעות רלוונטיות',
  activeVotes: 'הצבעות פעילות',
} as const;

const numberFormat = new Intl.NumberFormat('he-IL');
const dateFormat = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem',
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function MetricCard({
  metric,
  label,
}: {
  metric: CouncilMetric;
  label: string;
}) {
  const stateLabel =
    metric.status === 'stale'
      ? 'דורש רענון'
      : metric.status === 'unavailable'
        ? 'לא זמין'
        : 'מעודכן';

  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTopline}>
        <h2>{label}</h2>
        <span className={styles[metric.status]}>{stateLabel}</span>
      </div>
      <p className={styles.metricValue}>
        {metric.value === null ? '—' : numberFormat.format(metric.value)}
      </p>
      {metric.status === 'unavailable' ? (
        <p className={styles.unavailableCopy}>
          הנתון יופיע לאחר אימות המקור.
        </p>
      ) : null}
      <details className={styles.definition}>
        <summary>איך הנתון מחושב?</summary>
        <p>{metric.definition}</p>
      </details>
      {metric.source ? (
        <div className={styles.source}>
          <span>מקור: </span>
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
          <span> · נכון ל־{formatDate(metric.source.asOf)}</span>
          <span> · עודכן {formatDate(metric.source.updatedAt)}</span>
        </div>
      ) : (
        <p className={styles.source}>מקור מלא טרם פורסם.</p>
      )}
    </article>
  );
}

function LoadingState() {
  return (
    <main
      className={styles.shell}
      dir="rtl"
      aria-busy="true"
      aria-label="טוען נתוני מועצה"
    >
      <p className={styles.eyebrow}>פרופיל מועצה · COUNCIL</p>
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.shell} dir="rtl">
      <section className={styles.message} role="status">
        <p className={styles.eyebrow}>פרופיל מועצה · COUNCIL</p>
        <h1>{title}</h1>
        <p>{children}</p>
        <Link href="/he">חזרה לעמוד הראשי</Link>
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

  if (state.kind === 'loading') return <LoadingState />;
  if (state.kind === 'not-found') {
    return (
      <MessageState title="המועצה לא נמצאה">
        לא מצאנו מועצה ציבורית שמתאימה לכתובת הזו.
      </MessageState>
    );
  }
  if (state.kind === 'error') {
    return (
      <MessageState title="הנתונים אינם זמינים כרגע">
        לא הצלחנו לטעון את נתוני המועצה. אפשר לנסות שוב בעוד כמה דקות.
      </MessageState>
    );
  }

  const { profile } = state;
  const metrics = Object.entries(profile.metrics) as [
    keyof typeof labels,
    CouncilMetric,
  ][];

  return (
    <main className={styles.shell} dir="rtl">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>פרופיל מועצה · COUNCIL</p>
        <h1>{profile.council.name}</h1>
        <p className={styles.intro}>
          תמונה ציבורית של האוכלוסייה הרשמית והקהילה הפעילה בתַּרְאוּ.
          הנתונים מצרפיים בלבד — ללא פרטים על אנשים.
        </p>
        <p className={styles.generated}>
          תמונת מצב נוצרה ב־{formatDate(profile.generatedAt)}
        </p>
      </header>

      <section className={styles.metricsGrid} aria-label="מדדי המועצה">
        {metrics.map(([key, metric]) => (
          <MetricCard key={key} label={labels[key]} metric={metric} />
        ))}
      </section>

      {profile.metrics.registeredUsers.value === 0 &&
      profile.metrics.communityManagers.value === 0 &&
      profile.metrics.relevantVotes.value === 0 ? (
        <section className={styles.empty} aria-label="מועצה ללא פעילות">
          <h2>הקהילה המקומית עוד לא התחילה לפעול</h2>
          <p>
            זו אינה שגיאה: כרגע אין משתמשים, מנהלים או הצבעות משויכים למועצה
            בתַּרְאוּ.
          </p>
        </section>
      ) : null}

      <nav className={styles.actions} aria-label="קישורי מועצה">
        <Link href={profile.links.votes}>לכל ההצבעות במועצה</Link>
        <Link href={profile.links.civicSpace}>למרחב האזרחי הקיים</Link>
      </nav>

      <aside className={styles.privacy} aria-label="הערת פרטיות">
        <strong>שקיפות בלי חשיפה.</strong>
        <span>
          העמוד מציג ספירות ומקורות בלבד. שמות, כתובות, פרטי זיהוי ופרטי תשלום
          אינם נכללים בתגובה הציבורית.
        </span>
      </aside>
    </main>
  );
}
