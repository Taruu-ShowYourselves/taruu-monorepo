import { KNESSET_SCOPE } from '@sync/shared';
import { getKnessetRankingsByVoteIds } from '@/lib/supabase/db';
import { activeVotesWithOptions } from '@/server/read/active-votes';
import { activeVoteCardArt } from '@/server/read/card-art';
import { NewsButton } from '@/components/press/NewsButton';
import type { Locale } from '@/lib/i18n';
import { formatBillTitle } from '@/lib/knesset/billTitle';
import { DeskStream } from './DeskStream';
import { toDeskTopic } from './deskData';
import styles from './ConsensusDesk.module.css';
import { localePrefix } from '@/lib/i18n';

interface KnessetDeskProps {
  locale?: Locale;
  /** Rendered inside the tabbed desk section - the stream without the
   *  section shell, whose landmarks and headline the tabs own. */
  embedded?: boolean;
}

/**
 * The national print run. The full agenda lives on /knesset; the front page
 * carries the hottest dozen - see the cap note on ConsensusDesk.
 */
const TOPICS_TOTAL = 12;

interface KnessetDeskCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  emptyLede: string;
  emptyNote: string;
  emptyCta: string;
  arrow: string;
  carouselLabel: string;
}

const COPY: Record<Locale, KnessetDeskCopy> = {
  he: {
    kicker: 'המהדורה הארצית · THE KNESSET DESK',
    headlineLead: 'על סדר היום',
    headlineAccent: 'בכנסת.',
    standfirst:
      'עמדת הרוב האזרחי על הנושאים שעל שולחן הכנסת: אותו מנגנון אימות, אותה ספירה שקופה, בקנה מידה ארצי.',
    emptyLede: 'הדסק הארצי בהכנה. הנושאים הראשונים בדרך לדפוס.',
    emptyNote: 'מתחילים ברשויות המקומיות; משם עולים לירושלים.',
    emptyCta: 'על הדסק הארצי',
    arrow: '←',
    carouselLabel: 'נושאים על סדר יום הכנסת',
  },
  en: {
    kicker: 'THE NATIONAL EDITION · THE KNESSET DESK',
    headlineLead: 'On the agenda',
    headlineAccent: 'in the Knesset.',
    standfirst:
      "The civic majority's position on the issues before the Knesset: the same verification mechanism, the same transparent count, at national scale.",
    emptyLede: 'The national desk is in preparation. The first topics are on their way to print.',
    emptyNote: 'It begins in the municipalities; from there, on to Jerusalem.',
    emptyCta: 'About the national desk',
    arrow: '→',
    carouselLabel: 'Topics on the Knesset agenda',
  },
};

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
export async function KnessetDesk({
  locale = 'he',
  embedded = false,
}: KnessetDeskProps) {
  const t = COPY[locale];
  // Degrade to the empty-state desk when the DB is unreachable - notably at
  // build-time prerender in CI, where the service-role key deliberately does
  // not exist (#39); ISR refills real data at runtime on the Worker.
  // Filtered out of the shared request-scoped ledger rather than fetched
  // again: the civic desk already pulls every active vote and discards the
  // national ones, so a second scoped query was buying nothing.
  const votes = (await activeVotesWithOptions()).filter(
    (vote) => vote.municipality_id === KNESSET_SCOPE
  );
  // Editorial hotness from the ranker agent orders the desk; social-source
  // engagement is the fallback signal for unranked items. Card art is the
  // art job's faded tile plates. (Both helpers degrade to an empty map on
  // DB failure - no catch needed.)
  const voteIds = votes.map((v) => v.id);
  const [rankings, art] = await Promise.all([
    getKnessetRankingsByVoteIds(voteIds),
    // Request-memoised across every desk on the page - see card-art.ts.
    activeVoteCardArt(),
  ]);
  const heatOf = (topicId: string, sourceHotness: number) =>
    rankings.get(topicId)?.hotness ?? sourceHotness;
  const topics = votes
    // Agenda titles arrive as legal citations (`הצעת חוק X (תיקון מס' N), התשפ"ו-2026`),
    // sometimes truncated mid-clause by the sync. Split them so the tile can
    // set the instrument, the subject and the qualifier as separate furniture.
    .map((vote) => {
      const topic = toDeskTopic(vote, art.get(vote.id) ?? null);
      return { ...topic, titleParts: formatBillTitle(topic.title) };
    })
    .sort(
      (a, b) =>
        heatOf(b.id, b.source?.hotness ?? 0) - heatOf(a.id, a.source?.hotness ?? 0)
    )
    // The print run: hottest first, so the slice is the front page.
    .slice(0, TOPICS_TOTAL);

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

  const emptyState = (
    <div className={styles.emptyState}>
      <p className={styles.emptyLede}>{t.emptyLede}</p>
      <p className={styles.emptyNote}>{t.emptyNote}</p>
      <NewsButton
        href={`${localePrefix(locale)}/knesset`}
        variant="outline"
        size="md"
        trailing={<span aria-hidden>{t.arrow}</span>}
      >
        {t.emptyCta}
      </NewsButton>
    </div>
  );

  const stream = (
    <DeskStream
      label={t.carouselLabel}
      locale={locale}
      entries={topics.map((topic) => ({
        topic,
        municipality: KNESSET_SCOPE,
        ranking: deskRankingOf(topic.id),
        heatRank: rankings.has(topic.id)
          ? rankedIds.indexOf(topic.id) + 1
          : undefined,
      }))}
    />
  );

  if (embedded) {
    /* The tabbed section owns the frame and the headline; this is the
       national filling. */
    return topics.length === 0 ? emptyState : stream;
  }

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
            {t.kicker}
          </span>

          <h2 id="knesset-desk-headline" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>

          <p className={styles.standfirst}>{t.standfirst}</p>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        {topics.length === 0 ? emptyState : stream}
      </div>
    </section>
  );
}
