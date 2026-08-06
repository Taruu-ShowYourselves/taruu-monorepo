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
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

// The homepage carries live civic data, but "live" is the client's job: the
// dashboard and the intro re-poll /api/votes and /api/stats/* every 30s, so
// only the pre-hydration shell can be stale, and only for a minute. Rendering
// it per request instead cost a ~4s TTFB - every visitor paid a full SSR plus
// ~7 Supabase round-trips. Requires the incremental cache wired in
// open-next.config.ts, or this is inert on Workers.
export const revalidate = 60;

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  return (
    <HomepageExperience
      locale={locale}
      liveDashboard={<EventDashboard locale={locale} />}
    >
      <div className="np-page">
        <main>
          <CivicReminder locale={locale} />
          <WhatIsTaruu locale={locale} />
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
