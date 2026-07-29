import Link from 'next/link';
import { KNESSET_SCOPE } from '@sync/shared';
import {
  getActiveVotesWithOptions,
  getKnessetRankingsByVoteIds,
} from '@/lib/supabase/db';
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
  // Editorial hotness from the ranker agent orders the desk; social-source
  // engagement is the fallback signal for unranked items. (The helper
  // degrades to an empty map on DB failure — no catch needed.)
  const rankings = await getKnessetRankingsByVoteIds(votes.map((v) => v.id));
  const heatOf = (topicId: string, sourceHotness: number) =>
    rankings.get(topicId)?.hotness ?? sourceHotness;
  const topics = votes
    .map(toDeskTopic)
    .sort(
      (a, b) =>
        heatOf(b.id, b.source?.hotness ?? 0) - heatOf(a.id, a.source?.hotness ?? 0)
    );

  // Ranked topics carry the editorial evidence strip; heat rank is their
  // 1-based position among ranked items (the list is already heat-sorted).
  const rankedIds = topics.filter((t) => rankings.has(t.id)).map((t) => t.id);
  const deskRankingOf = (topicId: string) => {
    const row = rankings.get(topicId);
    if (!row) return null;
    return {
      hotness: row.hotness,
      relevance: row.relevance,
      media: row.media,
      rationale: row.rationale,
      mediaRefs: Array.isArray(row.media_refs) ? row.media_refs : [],
      rankedAt: row.ranked_at,
    };
  };

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
            עמדת הרוב האזרחי על הנושאים שעל שולחן הכנסת: אותו מנגנון אימות,
            אותה ספירה שקופה, בקנה מידה ארצי.
          </p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {topics.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyLede}>
              הדסק הארצי בהכנה. הנושאים הראשונים בדרך לדפוס.
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
                <DeskTopicRow
                  key={topic.id}
                  topic={topic}
                  municipality={KNESSET_SCOPE}
                  index={i}
                  ranking={deskRankingOf(topic.id)}
                  heatRank={
                    rankings.has(topic.id)
                      ? rankedIds.indexOf(topic.id) + 1
                      : undefined
                  }
                  locale={locale}
                />
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
