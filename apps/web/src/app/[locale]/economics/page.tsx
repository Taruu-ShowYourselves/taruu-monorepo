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
  title: 'איך תַּרְאוּ עובדת | הכלכלה שמאחורי ההצבעות',
  description:
    'המודל הכלכלי של תַּרְאוּ: ההצבעה חינם, כל הצבעה מקבלת BAG ב-bags.fm, והשקעות חיצוניות מזרימות כסף לקרן הקהילתית. כל עסקה גלויה.',
  openGraph: {
    title: 'הכלכלה האזרחית של תַּרְאוּ',
    description:
      'כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין שמאפשר לכל אחד להשקיע בתנועה הכלכלית של הנושא ולתמוך בביצוע ההחלטה. כל עסקה גלויה.',
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
