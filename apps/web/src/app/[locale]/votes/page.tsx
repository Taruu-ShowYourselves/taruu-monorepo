import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VotesHero } from './components/VotesHero';
import { ComingSoon } from '@/components/ui/ComingSoon';
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

  const t = {
    title: locale === 'en' ? 'Voting Board Coming Soon' : 'לוח ההצבעות בקרוב',
    description: locale === 'en'
      ? 'The first vote in Kiryat Tivon will start on 23.01.26. Join the pilot WhatsApp to be the first to know.'
      : 'ההצבעה הראשונה בקריית טבעון תתחיל ב-23.01.26. הצטרפו לוואטסאפ הפיילוט כדי להיות הראשונים לדעת.',
  };

  return (
    <>
      <Header locale={locale} />
      <main>
        <VotesHero />
        <ComingSoon
          title={t.title}
          description={t.description}
        />
      </main>
      <Footer locale={locale} />
    </>
  );
}
