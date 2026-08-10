import {
  EventDashboard,
  HomepageExperience,
  Masthead,
  Ticker,
} from '@/components/press';
import {
  KnessetDesk,
  ConsensusDesk,
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
      introStory="thesis"
      liveDashboard={<EventDashboard locale={locale} />}
    >
      {/* Three beats, in the order a resident needs them: the intro says what
          this is, the two desks show what is actually open in their town and
          in the Knesset, and the reminder says who all of it is addressed to.

          The case for the mechanism is deliberately absent. WhatIsTaruu (three
          branches of government, the diagnosis) and CivicMandate (the
          declaration) argue in the register of a prospectus, and a resident
          arriving to see what is open in their town does not need to be argued
          into it first. Both are intact on the investor edition at /pitchdeck,
          which is also where the intro keeps all three of its acts - this page
          opens straight on the thesis.

          Masthead and Ticker are furniture, not a beat: the nav has to be
          above the first thing a reader might act on, so it leads the site
          layer. The desk carries [data-nav-reveal], which now sits close
          enough behind it that the pinned dock is effectively never deferred. */}
      <div className="np-page">
        <main>
          <Masthead locale={locale} />
          <Ticker locale={locale} />
          <ConsensusDesk locale={locale} />
          <KnessetDesk locale={locale} />
          <CivicReminder locale={locale} />
        </main>
        <Colophon locale={locale} />
      </div>
    </HomepageExperience>
  );
}
