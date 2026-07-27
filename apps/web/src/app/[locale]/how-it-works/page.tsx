import { Metadata } from 'next';
import { Masthead } from '@/components/press';
import {
  Participate,
  Pillars,
  HowItWorks,
  PilotDispatch,
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'איך זה עובד',
  description:
    'כך תַּרְאוּ מודדת קונצנזוס אזרחי: כלי ההשתתפות, עמודי התווך של המנגנון, שלבי התהליך והפתיחה הארצית ב-04.08.26.',
};

interface HowItWorksPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HowItWorksPage({ params }: HowItWorksPageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main>
        <Participate locale={locale} />
        <Pillars locale={locale} />
        <HowItWorks locale={locale} />
        <PilotDispatch locale={locale} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
