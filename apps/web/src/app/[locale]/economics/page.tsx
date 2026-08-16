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

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'איך תַּרְאוּ עובדת | הכלכלה שמאחורי ההצבעות',
    description:
      'המודל הכלכלי של תַּרְאוּ: ההצבעה חינם, כל הצבעה מקבלת BAG ב-bags.fm, והשקעות חיצוניות מזרימות כסף לקרן הקהילתית. כל עסקה גלויה.',
    openGraph: {
      title: 'הכלכלה האזרחית של תַּרְאוּ',
      description:
        'כל הצבעה מקבלת BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין שמאפשר לכל אחד להשקיע בתנועה הכלכלית של הנושא ולתמוך בביצוע ההחלטה. כל עסקה גלויה.',
      type: 'website',
    },
  },
  en: {
    title: 'How Taruu works | The economics behind the votes',
    description:
      "Taruu's economic model: voting is free, every vote gets a BAG on bags.fm, and outside investment flows money into the community fund. Every transaction is visible.",
    openGraph: {
      title: 'The civic economics of Taruu',
      description:
        'Every vote gets its own BAG on bags.fm: a blockchain-based meme coin that lets anyone invest in the economic momentum of a topic and back carrying out the decision. Every transaction is visible.',
      type: 'website',
    },
  },
};

interface EconomicsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: EconomicsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function EconomicsPage({ params }: EconomicsPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <HeroSection locale={locale} />
        <LiveDashboard locale={locale} />
        <FlywheelDiagram locale={locale} />
        <HowItWorks locale={locale} />
        <FAQ locale={locale} />
        <CTASection locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
