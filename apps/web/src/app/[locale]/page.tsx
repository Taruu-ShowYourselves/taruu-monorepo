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
  CivicReminder,
  ActNow,
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

// The homepage contains live civic data and a scroll-driven client handoff.
// Never serve a stale cinematic shell during development or production.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  return (
    <HomepageExperience
      liveDashboard={<EventDashboard locale={locale} />}
    >
      <div className="np-page">
        <Masthead locale={locale} />
        <Ticker />
        <main>
          <WhatIsTaruu locale={locale} />
          <CivicReminder locale={locale} />
          <ConsensusDesk locale={locale} />
          <KnessetDesk locale={locale} />
          <ActNow locale={locale} />
        </main>
        <Colophon locale={locale} />
      </div>
    </HomepageExperience>
  );
}
