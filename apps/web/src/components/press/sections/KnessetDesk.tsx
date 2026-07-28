import Link from 'next/link';
import { KNESSET_SCOPE } from '@sync/shared';
import { getActiveVotesWithOptions } from '@/lib/supabase/db';
import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import { DeskTopicRow } from './DeskTopicRow';
import { DeskCarousel } from './DeskCarousel';
import { toDeskTopic } from './deskData';
import styles from './ConsensusDesk.module.css';

interface KnessetDeskProps {
  locale?: Locale;
}

/**
 * KnessetDesk — the national desk on the front page. Knesset-agenda topics
 * (votes scoped to KNESSET_SCOPE) with the same meters and engagement heat
 * as the municipal desk. Server component; shares the desk furniture.
 */
export async function KnessetDesk({ locale = 'he' }: KnessetDeskProps) {
  // Degrade to the empty-state desk when the DB is unreachable — notably at
  // build-time prerender in CI, where the service-role key deliberately does
  // not exist (#39); ISR refills real data at runtime on the Worker.
  const votes = await getActiveVotesWithOptions(KNESSET_SCOPE).catch(() => []);
  const topics = votes
    .map(toDeskTopic)
    .sort((a, b) => (b.source?.hotness ?? 0) - (a.source?.hotness ?? 0));

  return (
    <section
      id="knesset-desk"
      className={styles.desk}
      style={{ background: 'var(--np-paper-2)' }}
      aria-labelledby="knesset-desk-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            המהדורה הארצית · THE KNESSET DESK
          </span>

          <h2 id="knesset-desk-headline" className={styles.headline}>
            על סדר היום <span className={styles.red}>בכנסת.</span>
          </h2>

          <p className={styles.standfirst}>
            עמדת הרוב האזרחי על הנושאים שעל שולחן הכנסת — אותו מנגנון אימות,
            אותה ספירה שקופה, בקנה מידה ארצי.
          </p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {topics.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyLede}>
              הדסק הארצי בהכנה — הנושאים הראשונים בדרך לדפוס.
            </p>
            <p className={styles.emptyNote}>
              מתחילים ברשויות המקומיות; משם עולים לירושלים.
            </p>
            <NewsButton
              href={`/${locale}/knesset`}
              variant="outline"
              size="md"
              trailing={<span aria-hidden>←</span>}
            >
              על הדסק הארצי
            </NewsButton>
          </div>
        ) : (
          <>
            <DeskCarousel label="נושאים על סדר יום הכנסת">
              {topics.map((topic, i) => (
                <DeskTopicRow key={topic.id} topic={topic} index={i} locale={locale} />
              ))}
            </DeskCarousel>
            <div className={styles.deskFooter}>
              <Link href={`/${locale}/knesset`} className={styles.sourceLink}>
                לדסק הארצי המלא ←
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
