import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CoinDossier } from '../components/CoinDossier';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'BAG · bags.fm',
  description:
    'תיק ה-BAG: ההצבעה שהוא מגבה ב-bags.fm, ההיצע, סכום הגיוס, מחזיקי ה-BAG והחתימה בבלוקצ׳יין. שקוף ומאומת.',
};

interface CoinDetailPageProps {
  params: Promise<{ locale: Locale; id: string }>;
}

export default async function CoinDetailPage({ params }: CoinDetailPageProps) {
  const { locale, id } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <CoinDossier voteId={id} locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
