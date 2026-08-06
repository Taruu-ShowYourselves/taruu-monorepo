import type { Metadata } from 'next';
import {
  getActiveVotesWithOptions,
  getKnessetItemsByVoteIds,
  getKnessetRankingsByVoteIds,
} from '@/lib/supabase/db';
import type { KnessetRanking } from '@/lib/supabase/types';
import type { Locale } from '@/lib/i18n';
import { buildFeedItems } from './feedData';
import { FeedReader } from './components/FeedReader';

// The stream is live civic data; a stale edition is worse than a slow one.
export const revalidate = 60;

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'המהדורה שלי · הפיד',
    description:
      'נושא אחרי נושא: מה עומד להצבעה ברשות שלכם ועל שולחן הכנסת, איפה עומדת ' +
      'הספירה, ואיפה נרשם הקול שלכם.',
  },
  en: {
    title: 'My Edition · The Feed',
    description:
      'Topic by topic: what is up for a vote in your municipality and on the ' +
      "Knesset's table, where the count stands, and where your vote is on record.",
  },
};

interface FeedPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: FeedPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale] ?? METADATA.he;
}

/**
 * /feed - the reader's own edition, one topic per screen.
 *
 * Server component: pulls both desks once per revalidation window and hands
 * the flattened stream to the client reader, which orders it by the device's
 * stored locality. Degrades to the empty edition when the DB is unreachable
 * (CI prerender has no service-role key - #39); ISR refills at runtime.
 */
export default async function FeedPage({ params }: FeedPageProps) {
  const { locale } = await params;

  const votes = await getActiveVotesWithOptions().catch(() => []);
  const voteIds = votes.map((vote) => vote.id);
  const [knessetItems, rankings] = await Promise.all([
    getKnessetItemsByVoteIds(voteIds).catch(() => []),
    getKnessetRankingsByVoteIds(voteIds).catch(
      () => new Map<string, KnessetRanking>()
    ),
  ]);

  const items = buildFeedItems(votes, knessetItems, rankings, locale);

  return <FeedReader items={items} locale={locale} />;
}
