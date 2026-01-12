import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AboutHero } from './components/AboutHero';
import { Mission } from './components/Mission';
import { Technology } from './components/Technology';
import { Team } from './components/Team';
import { CTA } from '@/components/sections/CTA';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'אודות',
  description:
    'למדו על החזון שלנו, הטכנולוגיה מאחורי תַּרְאוּ, והצוות שעומד מאחורי הפלטפורמה.',
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
        <Team />
        <CTA locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
