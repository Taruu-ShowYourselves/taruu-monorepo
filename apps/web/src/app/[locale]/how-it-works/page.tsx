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

interface HowItWorksMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, HowItWorksMetaCopy> = {
  he: {
    title: 'איך זה עובד',
    description:
      'כך תַּרְאוּ מודדת קונצנזוס אזרחי: כלי ההשתתפות, עמודי התווך של המנגנון, שלבי התהליך והפתיחה הארצית ב-04.08.26.',
  },
  en: {
    title: 'How it works',
    description:
      'How Taruu measures civic consensus: the participation tools, the pillars of the mechanism, the steps of the process, and the national launch on 04.08.26.',
  },
};

interface HowItWorksPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: HowItWorksPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
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
