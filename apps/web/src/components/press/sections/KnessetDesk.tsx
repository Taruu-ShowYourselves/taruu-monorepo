import Link from 'next/link';
import { KNESSET_SCOPE } from '@sync/shared';
import {
  getActiveVotesWithOptions,
  getKnessetRankingsByVoteIds,
} from '@/lib/supabase/db';
import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import { formatBillTitle } from '@/lib/knesset/billTitle';
import { DeskTopicRow, slotVariant } from './DeskTopicRow';
import { DeskCarousel } from './DeskCarousel';
import { toDeskTopic } from './deskData';
import styles from './ConsensusDesk.module.css';

interface KnessetDeskProps {
  locale?: Locale;
}

/**
 * Distinct verified outlets behind a ranking's media score, from the
 * ranker's stored evidence. Rows written before the ranker counted its
 * coverage carry no evidence - they report null and the strip falls back
 * to the opaque sub-score.
 */
function outletsCountedOf(evidence: unknown): number | null {
  if (!evidence || typeof evidence !== 'object') return null;
  const count = (evidence as { outletsCounted?: unknown }).outletsCounted;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

/**
 * KnessetDesk - the national desk on the front page. Knesset-agenda topics
 * (votes scoped to KNESSET_SCOPE) with the same meters and engagement heat
 * as the municipal desk. Server component; shares the desk furniture.
 */
export async function KnessetDesk({ locale = 'he' }: KnessetDeskProps) {
  // Degrade to the empty-state desk when the DB is unreachable - notably at
  // build-time prerender in CI, where the service-role key deliberately does
  // not exist (#39); ISR refills real data at runtime on the Worker.
  const votes = await getActiveVotesWithOptions(KNESSET_SCOPE).catch(() => []);
  // Editorial hotness from the ranker agent orders the desk; social-source
  // engagement is the fallback signal for unranked items. (The helper
  // degrades to an empty map on DB failure - no catch needed.)
  const rankings = await getKnessetRankingsByVoteIds(votes.map((v) => v.id));
  const heatOf = (topicId: string, sourceHotness: number) =>
    rankings.get(topicId)?.hotness ?? sourceHotness;
  const topics = votes
    // Agenda titles arrive as legal citations (`הצעת חוק X (תיקון מס' N), התשפ"ו-2026`),
    // sometimes truncated mid-clause by the sync. Split them so the tile can
    // set the instrument, the subject and the qualifier as separate furniture.
    .map((vote) => {
      const topic = toDeskTopic(vote);
      return { ...topic, titleParts: formatBillTitle(topic.title) };
    })
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
      headline: row.headline,
      relevance: row.relevance,
      media: row.media,
      outletsCounted: outletsCountedOf(row.media_evidence),
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
                  variant={slotVariant(i)}
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
