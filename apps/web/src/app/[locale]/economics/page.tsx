import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from './components/HeroSection';
import { FlywheelDiagram } from './components/FlywheelDiagram';
import { LiveDashboard } from './components/LiveDashboard';
import { HowItWorks } from './components/HowItWorks';
import { FAQ } from './components/FAQ';
import { CTASection } from './components/CTASection';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'איך תַּרְאוּ עובד | הכלכלה שמאחורי ההצבעות',
  description:
    'גלה איך תַּרְאוּ הופכת כל הצבעה להזדמנות לגייס כסף לקהילה שלך. שקיפות מלאה, תמיכה גלובלית, השפעה מקומית.',
  openGraph: {
    title: 'הכלכלה של תַּרְאוּ - Local Votes, Global Support',
    description:
      'Every vote is a micro-fundraiser. See how Taruu multiplies community impact.',
    type: 'website',
  },
};

interface EconomicsPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function EconomicsPage({ params }: EconomicsPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <HeroSection />
        <LiveDashboard />
        <FlywheelDiagram />
        <HowItWorks />
        <FAQ />
        <CTASection locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
