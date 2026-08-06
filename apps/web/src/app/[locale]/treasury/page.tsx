import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TreasuryHero } from './components/TreasuryHero';
import { TreasuryDashboard } from './components/TreasuryDashboard';
import type { Locale } from '@/lib/i18n';

const META: Record<Locale, Metadata> = {
  he: {
    title: 'לוח הכפלה | קרן רשותית',
    description:
      'צפו ביתרת הקרן הרשותית, תרומות מקומיות ותמיכה חיצונית - השפעת SocialFi בפעולה.',
  },
  en: {
    title: 'The multiplier board | Municipal fund',
    description:
      'Watch the municipal fund balance, local contributions and external support - the SocialFi effect at work.',
  },
};

interface TreasuryPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: TreasuryPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

export default async function TreasuryPage({ params }: TreasuryPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <TreasuryHero locale={locale} />
        <TreasuryDashboard locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
