import { Metadata } from 'next';
import { Masthead, Ticker } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { VotesView } from './components/VotesView';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'הצבעות פומביות',
  description:
    'צפו בהצבעות פעילות, הצבעות שהסתיימו ותוצאות ברשויות המקומיות בישראל.',
};

interface VotesPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function VotesPage({ params }: VotesPageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <Ticker />
      <main>
        <VotesView />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
