import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AboutHero } from './components/AboutHero';
import { Mission } from './components/Mission';
import { Technology } from './components/Technology';
import { AboutCTA } from './components/AboutCTA';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'אודות',
  description:
    'למדו על החזון שלנו ועל הטכנולוגיה שמאחורי תַּרְאוּ.',
};

interface AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <AboutHero />
        <Mission />
        <Technology />
        <AboutCTA locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
