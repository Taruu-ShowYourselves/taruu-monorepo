import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AboutHero } from './components/AboutHero';
import { Mission } from './components/Mission';
import { Technology } from './components/Technology';
import { AboutCTA } from './components/AboutCTA';
import type { Locale } from '@/lib/i18n';

interface AboutMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, AboutMetaCopy> = {
  he: {
    title: 'אודות',
    description: 'למדו על החזון שלנו ועל הטכנולוגיה שמאחורי תַּרְאוּ.',
  },
  en: {
    title: 'About',
    description: 'Learn about our vision and the technology behind Taruu.',
  },
};

interface AboutPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <AboutHero locale={locale} />
        <Mission locale={locale} />
        <Technology locale={locale} />
        <AboutCTA locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
