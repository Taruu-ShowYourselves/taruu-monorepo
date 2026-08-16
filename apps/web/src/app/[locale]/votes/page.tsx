import { Metadata } from 'next';
import { Masthead, Ticker } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { VotesView } from './components/VotesView';
import type { Locale } from '@/lib/i18n';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'הצבעות פומביות',
    description:
      'צפו בהצבעות פעילות, הצבעות שהסתיימו ותוצאות ברשויות המקומיות בישראל.',
  },
  en: {
    title: 'Public Votes',
    description:
      'Follow active votes, concluded votes, and results across Israeli municipalities.',
  },
};

interface VotesPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: VotesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function VotesPage({ params }: VotesPageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <Ticker locale={locale} />
      <main>
        <VotesView locale={locale} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
