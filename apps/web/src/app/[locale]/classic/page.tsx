/* PROTOTYPE SCAFFOLD - the production homepage, parked here unchanged while
 * the simplified entry experience is being evaluated at `/`. Delete this
 * route (and restore `page.tsx`) to end the experiment.
 */
import {
  EventDashboard,
  HomepageExperience,
  Masthead,
  Ticker,
} from '@/components/press';
import {
  KnessetDesk,
  ConsensusDesk,
  DeskTabs,
  Colophon,
  HowToJoin,
  IsraelMapDesk,
  ThesisChapters,
} from '@/components/press/sections';
import {
  BeatMandateStage,
  BeatScoresStage,
} from '@/components/press/CinematicIntro/stages/BeatStages';
import { FacebookWall } from '@/components/press/sections/FacebookWall';
import { LocalityDesk } from '@/components/press/GeoGate/LocalityDesk';
import type { Locale } from '@/lib/i18n';

// The homepage carries live civic data, but "live" is the client's job: the
// dashboard and the intro re-poll /api/votes and /api/stats/* every 30s, so
// only the pre-hydration shell can be stale, and only for a minute. Rendering
// it per request instead cost a ~4s TTFB - every visitor paid a full SSR plus
// ~7 Supabase round-trips. Requires the incremental cache wired in
// open-next.config.ts, or this is inert on Workers.
export const revalidate = 60;

interface ClassicHomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ClassicHomePage({ params }: ClassicHomePageProps) {
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
          second. The intro is now one screen - the wordmark, the reminder the
          paper exists to make, and the mechanism in one sentence - and then
          the reader is in the desk.

          The two desks are one tabbed section now - מועצות מקומיות and ממשלה -
          and the section is exactly one viewport of river: no headline above
          the tiles, no second desk queued below them. A reader flips editions
          instead of scrolling past one to reach the other.

          LocalityDesk follows the desk because that is where its effect is
          legible: the tabbed river above it re-orders the moment a town is
          chosen. It replaced a modal that asked the same question at the
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
          <DeskTabs
            locale={locale}
            localPanel={<ConsensusDesk locale={locale} embedded />}
            nationalPanel={<KnessetDesk locale={locale} embedded />}
          />
          <LocalityDesk locale={locale} />
          {/* The live map answers the locality desk: the reader has just
              said where they live, and this is "and where is everyone else" -
              every open municipal topic pinned to its town, one viewport
              tall under the nav. */}
          <IsraelMapDesk locale={locale} />
          {/* The four claims as four standing sections - the scrubbed beat
              handoff is the pitch deck's delivery, not the homepage's. Each
              chapter carries the evidence for its claim behind the copy:
              the live desk behind the majority, the scores behind the score,
              the mandate sheet behind the court. */}
          <ThesisChapters
            locale={locale}
            backdrops={[
              /* The listening claim stands in front of what is being listened
                 to: the top-engagement posts, in Facebook's own chrome. */
              <FacebookWall key="facebook" locale={locale} />,
              {
                /* drifting: the majority claim stands in front of a LIVE
                   river, not a still of one. */
                node: (
                  <ConsensusDesk key="desk" locale={locale} decorative drifting />
                ),
                washed: true,
              },
              <BeatScoresStage key="scores" locale={locale} />,
              <BeatMandateStage key="mandate" locale={locale} />,
            ]}
          />
          {/* CivicReminder is gone from this page: its sentence is now the
              opening headline, and a page that closes by repeating its own
              masthead is a page padding itself. It still closes /pitchdeck
              and /what-is-taruu, where the reminder is the destination. */}
          <HowToJoin locale={locale} />
        </main>
        <Colophon locale={locale} />
      </div>
    </HomepageExperience>
  );
}
