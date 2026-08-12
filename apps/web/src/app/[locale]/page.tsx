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
  HowToJoin,
} from '@/components/press/sections';
import {
  BeatMandateStage,
  BeatScoresStage,
} from '@/components/press/CinematicIntro/stages/BeatStages';
import { CinematicIntro } from '@/components/press/CinematicIntro/CinematicIntro';
import { LocalityDesk } from '@/components/press/GeoGate/LocalityDesk';
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
      /* One screen, then the desks. The four claims it used to carry are now
         below both of them; see the note on the page body. */
      introStory="opening"
      liveDashboard={<EventDashboard locale={locale} />}
    >
      {/* The order a resident needs, which is evidence first and argument
          second. The intro is now one screen - the wordmark and what Taruu
          offers - and then the reader is in their own town's desk.

          LocalityDesk sits between the two carousels because that is where its
          effect is legible: the municipal river above it re-orders the moment a
          town is chosen, and the national desk below it is what everyone gets
          regardless. It replaced a modal that asked the same question at the
          door, before the reader had seen anything the answer changes.

          The four claims come after both desks. Argument in front of the
          evidence is a pitch; the same four sentences after two desks of live
          topics are the reader asking "so what happens with these" and being
          answered. HowToJoin closes the page: how to take part is the last
          thing, once they have seen what there is to take part in.

          The case for the mechanism is deliberately absent. WhatIsTaruu (three
          branches of government, the diagnosis) and CivicMandate (the
          declaration) argue in the register of a prospectus, and a resident
          arriving to see what is open in their town does not need to be argued
          into it first. Both are intact on the investor edition at /pitchdeck,
          which is also where the intro keeps all three of its acts.

          Masthead and Ticker are furniture, not a beat: the nav has to be
          above the first thing a reader might act on, so it leads the site
          layer. The desk carries [data-nav-reveal], which now sits close
          enough behind it that the pinned dock is effectively never deferred. */}
      <div className="np-page">
        <main>
          <Masthead locale={locale} />
          <Ticker locale={locale} />
          <ConsensusDesk locale={locale} />
          <LocalityDesk locale={locale} />
          <KnessetDesk locale={locale} />
          <CinematicIntro
            locale={locale}
            story="beats"
            beatStages={[
              <BeatScoresStage key="scores" locale={locale} />,
              <BeatMandateStage key="mandate" locale={locale} />,
            ]}
            deskBackdrop={<ConsensusDesk locale={locale} decorative />}
          />
          <CivicReminder locale={locale} />
          <HowToJoin locale={locale} />
        </main>
        <Colophon locale={locale} />
      </div>
    </HomepageExperience>
  );
}
