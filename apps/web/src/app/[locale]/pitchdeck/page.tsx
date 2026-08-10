import { Metadata } from 'next';
import {
  EventDashboard,
  HomepageExperience,
  Masthead,
  Ticker,
} from '@/components/press';
import {
  KnessetDesk,
  ConsensusDesk,
  WhatIsTaruu,
  CivicMandate,
  CivicReminder,
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

// The investor edition: the press homepage as it stood before the root page
// started shedding its theatre for a civilian-facing arrangement. Same live
// data, same 60s revalidate rationale as the homepage - the dashboard and the
// intro re-poll /api/votes and /api/stats/* every 30s, so only the
// pre-hydration shell can be stale, and only for a minute.
export const revalidate = 60;

interface PitchDeckMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, PitchDeckMetaCopy> = {
  he: {
    title: 'מצגת',
    description:
      'המהדורה המלאה של תַּרְאוּ: המנגנון האזרחי, שולחן הקונצנזוס, סדר היום של הכנסת והנתונים החיים.',
  },
  en: {
    title: 'Deck',
    description:
      'The full Taruu edition: the civic mechanism, the consensus desk, the Knesset agenda and the live numbers.',
  },
};

interface PitchDeckPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: PitchDeckPageProps): Promise<Metadata> {
  const { locale } = await params;
  // Investor-facing surface, not a public entry point: kept out of the sitemap
  // and out of the index so it does not compete with the homepage for the
  // same queries.
  return { ...META[locale], robots: { index: false, follow: false } };
}

export default async function PitchDeckPage({ params }: PitchDeckPageProps) {
  const { locale } = await params;

  return (
    <HomepageExperience
      locale={locale}
      liveDashboard={<EventDashboard locale={locale} />}
    >
      <div className="np-page">
        <main>
          <WhatIsTaruu locale={locale} />
          <CivicReminder locale={locale} />
          <CivicMandate locale={locale} />
          <Masthead locale={locale} />
          <Ticker locale={locale} />
          <ConsensusDesk locale={locale} />
          <KnessetDesk locale={locale} />
        </main>
        <Colophon locale={locale} />
      </div>
    </HomepageExperience>
  );
}
