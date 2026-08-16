import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MUNICIPALITIES } from '@sync/shared';
import {
  civicScorePercent,
  type LocalAuthorityKind,
  type MunicipalityCivicStats,
} from '@sync/shared/contracts';
import { Masthead, NewsButton } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { municipalityHref } from '@/components/uikit/municipality-link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/uikit/tabs';
import { AnimateIn } from '@/components/uikit/animate-in';
import { logger } from '@/lib/logger';
import {
  getCardArtByVoteIds,
  getMunicipalityProfile,
  type MunicipalityProfile,
  type MunicipalityVoteSummary,
} from '@/lib/supabase/db';
import { municipalityCivicStats } from '@/server/read/municipality-stats';
import { localePrefix, type Locale } from '@/lib/i18n';
import { BallotTile, type BallotKind } from './BallotTile';
import { CountFigure } from './CountFigure';
import {
  EM_DASH,
  formatScore,
  median,
  percent,
  scoreBand,
  trackGeometry,
} from './civicFigures';
import { COPY, type MunicipalityCopy } from './copy';
import styles from './MunicipalityProfile.module.css';

// Aggregations are heavy-ish; refresh every 5 minutes like the homepage desks.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

function resolveMunicipality(slug: string): string | null {
  const name = decodeURIComponent(slug).trim();
  return (MUNICIPALITIES as readonly string[]).includes(name) ? name : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = COPY[locale];
  const name = resolveMunicipality(slug);
  if (!name) return { title: t.notFoundTitle };
  return { title: t.metaTitle(name), description: t.metaDescription(name) };
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

function formatHours(t: MunicipalityCopy, hours: number): string {
  if (hours < 1) return t.minutes(Math.round(hours * 60));
  if (hours < 48) return t.hours(Math.round(hours));
  return t.days(Math.round(hours / 24));
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

interface RailCellProps {
  label: string;
  value: number | null;
  note: string;
  locale: string;
  accent?: 'red' | 'faint';
  suffix?: string;
}

/** One figure in the index band: mono label, oversized count, faint note. */
function RailCell({ label, value, note, locale, accent, suffix }: RailCellProps) {
  return (
    <div className={styles.railCell} data-animate>
      <span className={styles.railLabel}>{label}</span>
      <b className={styles.railValue} data-accent={value === null ? 'faint' : accent}>
        <CountFigure value={value} locale={locale} suffix={suffix} />
      </b>
      <span className={styles.railNote}>{note}</span>
    </div>
  );
}

interface ScoreCardProps {
  label: string;
  score: number | null;
  medianScore: number | null;
  method: string;
  locale: string;
  t: MunicipalityCopy;
}

/**
 * One signed score on the shared -100..+100 track. Zero is drawn rather than
 * implied, and the national median is ticked onto the same track - a score
 * with nothing to stand against is only a number.
 */
function ScoreCard({ label, score, medianScore, method, locale, t }: ScoreCardProps) {
  const band = scoreBand(score);
  // The bar is drawn as a deviation from zero: where it starts and how far it
  // runs, not one percentage of the whole scale.
  const { from, span } = trackGeometry(score);
  return (
    <div className={styles.score} data-band={band} data-animate>
      <div className={styles.scoreHead}>
        <span className={styles.scoreLabel}>{label}</span>
        <b className={styles.scoreValue}>
          {score === null ? (
            EM_DASH
          ) : (
            <CountFigure value={score} locale={locale} signed />
          )}
        </b>
      </div>

      <div className={styles.track}>
        <span
          className={styles.trackFill}
          style={{
            ['--from' as string]: `${from}%`,
            ['--span' as string]: `${span}%`,
          }}
        />
        <span aria-hidden className={styles.trackZero} />
        {medianScore !== null ? (
          <span
            aria-hidden
            className={styles.trackMedian}
            style={{ ['--at' as string]: `${civicScorePercent(medianScore)}%` }}
          />
        ) : null}
      </div>

      <div className={styles.scaleRow}>
        <span>{t.scaleMin}</span>
        <span>0</span>
        <span>{t.scaleMax}</span>
      </div>

      <span className={styles.scoreNote}>
        {score === null
          ? t.unmeasured
          : medianScore !== null
            ? t.medianNote(formatScore(medianScore))
            : t.medianNone}
      </span>
      <p className={styles.scoreMethod}>{method}</p>
    </div>
  );
}

interface TempoCellProps {
  label: string;
  display: string;
  /** 0-100 bar position; null prints the hatched "not measured" track. */
  fill: number | null;
  caption: string;
}

function TempoCell({ label, display, fill, caption }: TempoCellProps) {
  const empty = fill === null;
  return (
    <div className={styles.tempoCell} data-animate>
      <span className={styles.railLabel}>{label}</span>
      <b className={styles.tempoValue} data-empty={empty ? 'true' : undefined}>
        {display}
      </b>
      <span aria-hidden className={styles.tempoTrack} data-empty={empty ? 'true' : undefined}>
        <span
          className={styles.tempoFill}
          style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, fill ?? 0))}%` }}
        />
      </span>
      <span className={styles.railNote}>{caption}</span>
    </div>
  );
}

interface StretchProps {
  votes: MunicipalityVoteSummary[];
  kind: BallotKind;
  art: Map<string, string>;
  locale: Locale;
  t: MunicipalityCopy;
  emptyTitle: string;
  emptyBody: string;
  emptyCta?: { href: string; label: string };
}

/**
 * A stretch of ballots, or the reason there are none. The empty state is a
 * printed notice with a way out of it, not a dashed grey box apologising.
 */
function Stretch({
  votes,
  kind,
  art,
  locale,
  t,
  emptyTitle,
  emptyBody,
  emptyCta,
}: StretchProps) {
  if (votes.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyKicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.emptyKicker}
        </span>
        <h3 className={styles.emptyTitle}>{emptyTitle}</h3>
        <p className={styles.emptyBody}>{emptyBody}</p>
        {emptyCta ? (
          <NewsButton
            href={emptyCta.href}
            variant="ink"
            size="sm"
            trailing={<span aria-hidden>{t.arrow}</span>}
          >
            {emptyCta.label}
          </NewsButton>
        ) : null}
      </div>
    );
  }

  // The heat rule is comparable only inside one stretch, so it is scaled to
  // the busiest ballot printed beside it rather than to a global maximum.
  const busiest = votes.reduce((max, vote) => Math.max(max, vote.totalBallots), 0);

  return (
    <AnimateIn className={styles.tileGrid}>
      {/* No `data-animate` wrapper: a grid item has to be the tile itself, so
          AnimateIn falls back to staggering the grid's direct children. */}
      {votes.map((vote, i) => (
        <BallotTile
          key={vote.id}
          vote={vote}
          index={i + 1}
          heat={busiest > 0 ? (vote.totalBallots / busiest) * 100 : 0}
          artUrl={art.get(vote.id) ?? null}
          kind={kind}
          locale={locale}
          t={t}
        />
      ))}
    </AnimateIn>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const EMPTY_PROFILE: MunicipalityProfile = {
  metrics: {
    residents: 0,
    participants: 0,
    engagementRate: null,
    avgTimeToEngageHours: null,
    satisfactionAvg: null,
    satisfactionCount: 0,
  },
  openVotes: [],
  closedVotes: [],
};

export default async function MunicipalityProfilePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const t = COPY[locale];
  const name = resolveMunicipality(slug);
  if (!name) notFound();

  // Degrade to the empty state rather than a 500 - the page's "no data yet"
  // copy is honest for both an unreachable DB and a genuinely empty one.
  const [profile, stats] = await Promise.all([
    getMunicipalityProfile(name).catch((error) => {
      logger.error('municipality profile unavailable', { error, name });
      return EMPTY_PROFILE;
    }),
    municipalityCivicStats(),
  ]);
  const { metrics, openVotes, closedVotes } = profile;

  // Faded tile plates from the desk's art job; degrades to an empty map.
  const art = await getCardArtByVoteIds(
    [...openVotes, ...closedVotes].map((vote) => vote.id)
  );

  // Open votes split by whether anyone has actually voted: with ballots they
  // are live races; without, they are topics waiting for a first voice.
  const liveVotes = openVotes.filter((v) => v.totalBallots > 0);
  const openTopics = openVotes.filter((v) => v.totalBallots === 0);
  const ballotsCounted = [...openVotes, ...closedVotes].reduce(
    (sum, vote) => sum + vote.totalBallots,
    0
  );

  // ---- Where this city stands in the field --------------------------------
  const self: MunicipalityCivicStats | undefined = stats.find(
    (entry) => entry.municipality === name
  );
  /* Falls back to the column's own default when the dial is unreachable: the
     page still has to name what it is about, and every authority that resolves
     to a slug today is a municipality. */
  const kind: LocalAuthorityKind = self?.kind ?? 'municipality';
  const ranked = stats
    .filter((entry) => entry.overallScore !== null)
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  const rank = ranked.findIndex((entry) => entry.municipality === name);
  const medians = {
    overall: median(stats.map((s) => s.overallScore)),
    engagement: median(stats.map((s) => s.engagementScore)),
    cooperation: median(stats.map((s) => s.cooperationScore)),
    satisfaction: median(stats.map((s) => s.satisfactionScore)),
  };

  /* Registered residents come from the profile RPC (a head-count of platform
     users); the population figure comes from the civic-stats RPC, which only
     reports one where a sourced, dated figure exists. They are different
     numbers and the band prints them as such - a platform head-count in a
     row labelled "residents" would be a claim about the city that Taruu is
     in no position to make. */
  const registered = Math.max(metrics.residents, self?.platformUsers ?? 0);
  const activeVoters = Math.max(metrics.participants, self?.activeParticipants ?? 0);
  const population = self?.residents ?? null;
  const openCount = Math.max(openVotes.length, self?.openTopics ?? 0);

  const reachPct = percent(registered, population);
  const votedPct = percent(activeVoters, registered);

  // Faster engagement fills the bar more; 72h+ reads as empty.
  const timeFill =
    metrics.avgTimeToEngageHours !== null
      ? Math.max(0, Math.min(100, 100 - (metrics.avgTimeToEngageHours / 72) * 100))
      : null;

  const others = stats
    .filter((entry) => entry.municipality !== name)
    .sort((a, b) => {
      if (a.overallScore === b.overallScore) return a.municipality.localeCompare(b.municipality);
      if (a.overallScore === null) return 1;
      if (b.overallScore === null) return -1;
      return b.overallScore - a.overallScore;
    });

  const createHref = `${localePrefix(locale)}/votes/create`;
  const defaultTab =
    liveVotes.length > 0 ? 'live' : openTopics.length > 0 ? 'topics' : 'closed';

  return (
    <div className="np-page">
      <Masthead locale={locale} />

      <main className={styles.page}>
        <div className={styles.inner}>
          {/* ---- Hero ---------------------------------------------------- */}
          <header className={styles.hero}>
            <nav className={styles.breadcrumb} aria-label={t.crumbDesk}>
              <a className={styles.crumb} href={localePrefix(locale) || '/'}>
                {t.crumbHome}
              </a>
              <span aria-hidden className={styles.crumbSep}>
                /
              </span>
              <span>{name}</span>
            </nav>

            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {t.kicker(kind)}
            </span>

            <div className={styles.heroGrid}>
              <div className={styles.heroMain}>
                <span aria-hidden className={styles.nameGhost}>
                  {name}
                </span>
                <h1 className={styles.name}>{name}</h1>
                <p className={styles.standfirst}>{t.standfirst(name)}</p>
                <div className={styles.heroActions}>
                  <NewsButton
                    href={createHref}
                    variant="red"
                    trailing={<span aria-hidden>{t.arrow}</span>}
                  >
                    {t.openTopicCta(name)}
                  </NewsButton>
                  <a className={styles.textLink} href={localePrefix(locale) || '/'}>
                    {t.deskCta}
                  </a>
                </div>
              </div>

              <aside className={styles.plate} data-band={scoreBand(self?.overallScore ?? null)}>
                <span className={styles.plateLabel}>{t.plateLabel}</span>
                <b className={styles.plateValue}>{formatScore(self?.overallScore ?? null)}</b>
                <span className={styles.plateRank}>
                  {rank >= 0 ? t.plateRank(rank + 1, ranked.length) : t.plateUnranked}
                </span>
                <span aria-hidden className={styles.plateScale}>
                  <span>{t.scaleMin}</span>
                  <span>{t.scaleMax}</span>
                </span>
              </aside>
            </div>
          </header>

          {/* ---- Index band ---------------------------------------------- */}
          <AnimateIn className={styles.rail} aria-label={t.indexTitle}>
            <RailCell
              label={t.railResidents}
              value={population}
              note={population === null ? t.railResidentsUnknown : t.railResidentsSourced}
              locale={t.dateLocale}
            />
            <RailCell
              label={t.railPlatform}
              value={registered}
              note={reachPct ? t.railPlatformNote(reachPct) : t.railPlatformNoReach}
              locale={t.dateLocale}
            />
            <RailCell
              label={t.railVoters}
              value={activeVoters}
              note={votedPct && activeVoters > 0 ? t.railVotersNote(votedPct) : t.railVotersNone}
              locale={t.dateLocale}
            />
            <RailCell
              label={t.railOpen}
              value={openCount}
              note={t.railOpenNote}
              locale={t.dateLocale}
              accent="red"
            />
            <RailCell
              label={t.railDecided}
              value={closedVotes.length}
              note={t.railDecidedNote}
              locale={t.dateLocale}
            />
            <RailCell
              label={t.railBallots}
              value={ballotsCounted}
              note={t.railBallotsNote}
              locale={t.dateLocale}
            />
          </AnimateIn>

          {/* ---- Civic index --------------------------------------------- */}
          <section className={styles.section} aria-label={t.indexTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.indexTitle}</h2>
              <p className={styles.sectionNote}>{t.indexNote}</p>
            </div>

            <AnimateIn className={styles.scoreGrid}>
              <ScoreCard
                label={t.scoreOverall}
                score={self?.overallScore ?? null}
                medianScore={medians.overall}
                method={t.methodOverall}
                locale={t.dateLocale}
                t={t}
              />
              <ScoreCard
                label={t.scoreEngagement}
                score={self?.engagementScore ?? null}
                medianScore={medians.engagement}
                method={t.methodEngagement}
                locale={t.dateLocale}
                t={t}
              />
              <ScoreCard
                label={t.scoreCooperation}
                score={self?.cooperationScore ?? null}
                medianScore={medians.cooperation}
                method={t.methodCooperation}
                locale={t.dateLocale}
                t={t}
              />
              <ScoreCard
                label={t.scoreSatisfaction}
                score={self?.satisfactionScore ?? null}
                medianScore={medians.satisfaction}
                method={t.methodSatisfaction}
                locale={t.dateLocale}
                t={t}
              />
            </AnimateIn>

            <AnimateIn className={styles.tempo}>
              <TempoCell
                label={t.tempoParticipation}
                display={
                  metrics.engagementRate !== null
                    ? `${Math.round(metrics.engagementRate * 100)}%`
                    : EM_DASH
                }
                fill={
                  metrics.engagementRate !== null ? metrics.engagementRate * 100 : null
                }
                caption={
                  metrics.engagementRate !== null
                    ? t.tempoParticipationCaption(
                        activeVoters.toLocaleString(t.dateLocale),
                        registered.toLocaleString(t.dateLocale)
                      )
                    : t.tempoNoData
                }
              />
              <TempoCell
                label={t.tempoTime}
                display={
                  metrics.avgTimeToEngageHours !== null
                    ? formatHours(t, metrics.avgTimeToEngageHours)
                    : EM_DASH
                }
                fill={timeFill}
                caption={
                  metrics.avgTimeToEngageHours !== null ? t.tempoTimeCaption : t.tempoNoData
                }
              />
              <TempoCell
                label={t.tempoSatisfaction}
                display={
                  metrics.satisfactionAvg !== null
                    ? `${metrics.satisfactionAvg.toFixed(1)} / 5`
                    : EM_DASH
                }
                fill={
                  metrics.satisfactionAvg !== null
                    ? (metrics.satisfactionAvg / 5) * 100
                    : null
                }
                caption={
                  metrics.satisfactionCount > 0
                    ? t.tempoSatisfactionCaption(
                        metrics.satisfactionCount.toLocaleString(t.dateLocale)
                      )
                    : t.tempoNoRatings
                }
              />
            </AnimateIn>
          </section>

          {/* ---- Ballots -------------------------------------------------- */}
          <section className={styles.section} aria-label={t.votesTitle}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t.votesTitle}</h2>
              <p className={styles.sectionNote}>{t.votesNote}</p>
            </div>

            <Tabs
              className={styles.tabsBlock}
              defaultValue={defaultTab}
              dir={locale === 'he' ? 'rtl' : 'ltr'}
            >
              <TabsList>
                <TabsTrigger value="live">
                  {t.tabLive}
                  <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                    {liveVotes.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="topics">
                  {t.tabTopics}
                  <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                    {openTopics.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="closed">
                  {t.tabClosed}
                  <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                    {closedVotes.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="live">
                <Stretch
                  votes={liveVotes}
                  kind="live"
                  art={art}
                  locale={locale}
                  t={t}
                  emptyTitle={t.emptyLiveTitle}
                  emptyBody={t.emptyLiveBody(name)}
                />
              </TabsContent>

              <TabsContent value="topics">
                <Stretch
                  votes={openTopics}
                  kind="topic"
                  art={art}
                  locale={locale}
                  t={t}
                  emptyTitle={t.emptyTopicsTitle}
                  emptyBody={t.emptyTopicsBody(name)}
                  emptyCta={{ href: createHref, label: t.openTopicCta(name) }}
                />
              </TabsContent>

              <TabsContent value="closed">
                <Stretch
                  votes={closedVotes}
                  kind="closed"
                  art={art}
                  locale={locale}
                  t={t}
                  emptyTitle={t.emptyClosedTitle}
                  emptyBody={t.emptyClosedBody(name)}
                />
              </TabsContent>
            </Tabs>
          </section>

          {/* ---- Other editions ------------------------------------------ */}
          {others.length > 0 ? (
            <section className={styles.section} aria-label={t.stripTitle}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{t.stripTitle}</h2>
                <p className={styles.sectionNote}>{t.stripNote}</p>
              </div>

              <div className={styles.strip}>
                {others.map((entry) => (
                  <a
                    key={entry.municipality}
                    className={styles.stripItem}
                    href={municipalityHref(entry.municipality, locale)}
                  >
                    <span className={styles.stripKind}>{t.kindLabel[entry.kind]}</span>
                    <span className={styles.stripName}>{entry.municipality}</span>
                    <span
                      className={styles.stripScore}
                      data-band={scoreBand(entry.overallScore)}
                    >
                      {formatScore(entry.overallScore)}
                    </span>
                    <span className={styles.stripTopics}>
                      {t.stripTopics(entry.openTopics)}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {/* ---- Closing band -------------------------------------------- */}
          <section className={styles.closing}>
            <div>
              <h2 className={styles.closingTitle}>{t.closingTitle}</h2>
              <p className={styles.closingBody}>{t.closingBody(name)}</p>
            </div>
            <NewsButton
              href={createHref}
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.openTopicCta(name)}
            </NewsButton>
          </section>
        </div>
      </main>

      <Colophon locale={locale} />
    </div>
  );
}
