import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SupportHero } from './components/SupportHero';
import { SupportFlow } from './components/SupportFlow';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'תמיכה | תַּרְאוּ',
  description:
    'יש שאלה? יש תשובה. כל מה שרציתם לדעת על הצבעה, אימות ופרטיות — במקום אחד. לא מצאתם? כתבו לנו בוואטסאפ.',
};

interface SupportPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function SupportPage({ params }: SupportPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <SupportHero />
        <SupportFlow locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
