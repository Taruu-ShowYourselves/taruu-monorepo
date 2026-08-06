import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MUNICIPALITIES } from '@sync/shared';
import { Masthead } from '@/components/press';
import { logger } from '@/lib/logger';
import {
  getMunicipalityProfile,
  type MunicipalityProfile,
  type MunicipalityVoteSummary,
} from '@/lib/supabase/db';
import { NewsButton } from '@/components/press/NewsButton';
import { AnimateIn } from '@/components/uikit/animate-in';
import { Badge } from '@/components/uikit/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/uikit/card';
import { MetricBar } from '@/components/uikit/metric-bar';
import { Progress } from '@/components/uikit/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/uikit/tabs';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';

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
  const { slug } = await params;
  const name = resolveMunicipality(slug);
  if (!name) return { title: 'רשות לא נמצאה | תַּרְאוּ' };
  return {
    title: `${name} · פרופיל רשות | תַּרְאוּ`,
    description: `שביעות רצון, מעורבות אזרחית וכל ההצבעות הפתוחות והסגורות ב${name}. נתונים מאומתים, שקופים לכולם.`,
  };
}

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '-';
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} דק׳`;
  if (hours < 48) return `${Math.round(hours)} שע׳`;
  return `${Math.round(hours / 24)} ימים`;
}

function VoteCard({ vote }: { vote: MunicipalityVoteSummary }) {
  const closed = vote.status === 'ended';
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <CardTitle className="min-w-0 flex-1">{vote.title}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {closed && vote.winningOption ? (
            <Badge variant="red">הוכרע: {vote.winningOption}</Badge>
          ) : null}
          <Badge variant={closed ? 'default' : 'red'}>
            {closed ? 'סגורה' : 'פתוחה · LIVE'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {vote.description ? (
          <p className="font-body text-base leading-relaxed text-ink-soft">
            {vote.description}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {vote.options.map((option) => (
            <div key={option.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm font-bold">{option.text}</span>
                <span className="font-mono text-sm tabular-nums text-ink-soft">
                  {option.pct}% · {option.votes.toLocaleString('he-IL')}
                </span>
              </div>
              <Progress value={option.pct} className="h-2" aria-label={option.text} />
            </div>
          ))}
          {vote.options.length === 0 ? (
            <p className="font-mono text-xs text-ink-faint">אין אפשרויות הצבעה.</p>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-faint">
        <span>{vote.totalBallots.toLocaleString('he-IL')} קולות מאומתים</span>
        <span>נפתחה {formatDate(vote.startDate)}</span>
        <span>{closed ? 'נסגרה' : 'נסגרת'} {formatDate(vote.endDate)}</span>
      </CardFooter>
    </Card>
  );
}

/**
 * Open topic nobody voted on yet - on the table, waiting for a first voice.
 * "Claiming" it is simply being the first to vote.
 */
function TopicCard({ vote, locale }: { vote: MunicipalityVoteSummary; locale: Locale }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <CardTitle className="min-w-0 flex-1">{vote.title}</CardTitle>
        <Badge variant="soft" className="shrink-0 border-dashed">
          עדיין בלי קולות
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {vote.description ? (
          <p className="font-body text-base leading-relaxed text-ink-soft">
            {vote.description}
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-2">
          {vote.options.map((option) => (
            <li
              key={option.id}
              className="border border-dashed border-ink-soft px-3 py-1 font-mono text-xs font-bold"
            >
              {option.text}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <NewsButton
          href={`${localePrefix(locale)}/votes/${vote.id}`}
          variant="red"
          size="sm"
          trailing={<span aria-hidden>←</span>}
        >
          הצביעו ראשונים
        </NewsButton>
        <span className="font-mono text-xs text-ink-faint">
          נסגרת {formatDate(vote.endDate)}
        </span>
      </CardFooter>
    </Card>
  );
}

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
  const name = resolveMunicipality(slug);
  if (!name) notFound();

  // Degrade to the empty state rather than a 500 - the page's "no data yet"
  // copy is honest for both an unreachable DB and a genuinely empty one.
  const { metrics, openVotes, closedVotes } = await getMunicipalityProfile(
    name
  ).catch((error) => {
    logger.error('municipality profile unavailable', { error, name });
    return EMPTY_PROFILE;
  });

  // Open votes split by whether anyone has actually voted: with ballots they
  // are live races; without, they are topics on the table waiting to be
  // claimed by a first voter.
  const liveVotes = openVotes.filter((v) => v.totalBallots > 0);
  const openTopics = openVotes.filter((v) => v.totalBallots === 0);

  const engagementPct =
    metrics.engagementRate !== null
      ? Math.round(metrics.engagementRate * 100)
      : null;
  // Faster engagement fills the bar more; 72h+ reads as empty.
  const timeBarValue =
    metrics.avgTimeToEngageHours !== null
      ? Math.max(0, Math.min(100, 100 - (metrics.avgTimeToEngageHours / 72) * 100))
      : null;
  const satisfactionPct =
    metrics.satisfactionAvg !== null
      ? Math.round((metrics.satisfactionAvg / 5) * 100)
      : null;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main className="np-container flex flex-col gap-8 py-8">
        {/* Dateline header */}
        <header className="flex flex-col gap-4">
          <span className="flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-red">
            <span aria-hidden className="inline-block size-[0.7em] bg-red" />
            פרופיל רשות · MUNICIPALITY
          </span>
          <h1 className="font-display text-6xl font-black leading-none tracking-tighter md:text-8xl">
            {name}
          </h1>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-ink/40 py-2 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
            <span className="flex items-baseline gap-2">
              <b className="font-display text-lg font-black tabular-nums text-ink">
                {metrics.residents.toLocaleString('he-IL')}
              </b>
              תושבים רשומים
            </span>
            <span className="flex items-baseline gap-2">
              <b className="font-display text-lg font-black tabular-nums text-ink">
                {metrics.participants.toLocaleString('he-IL')}
              </b>
              מצביעים
            </span>
            <span className="flex items-baseline gap-2">
              <b className="font-display text-lg font-black tabular-nums text-red">
                {openVotes.length}
              </b>
              הצבעות פתוחות
            </span>
          </div>
        </header>

        {/* Civic metrics - ruled index band, no boxes */}
        <section aria-label="מדדי הרשות">
          <AnimateIn className="grid grid-cols-1 border-y-2 border-ink md:grid-cols-3">
            <div
              data-animate
              className="border-ink py-6 md:border-s-2 md:px-8 md:first:border-s-0 md:first:ps-0 md:last:pe-0"
            >
              <MetricBar
                label="מעורבות אזרחית"
                value={engagementPct ?? 0}
                display={engagementPct !== null ? `${engagementPct}%` : '-'}
                caption={
                  engagementPct !== null
                    ? `${metrics.participants.toLocaleString('he-IL')} מצביעים מתוך ${metrics.residents.toLocaleString('he-IL')} תושבים רשומים`
                    : 'אין עדיין נתוני הצבעה'
                }
              />
            </div>
            <div
              data-animate
              className="border-t-2 border-ink py-6 md:border-s-2 md:border-t-0 md:px-8"
            >
              <MetricBar
                label="זמן עד הצבעה"
                value={timeBarValue ?? 0}
                display={
                  metrics.avgTimeToEngageHours !== null
                    ? formatHours(metrics.avgTimeToEngageHours)
                    : '-'
                }
                caption={
                  metrics.avgTimeToEngageHours !== null
                    ? 'ממוצע מפתיחת הצבעה ועד מתן הקול'
                    : 'אין עדיין נתוני הצבעה'
                }
              />
            </div>
            <div
              data-animate
              className="border-t-2 border-ink py-6 md:border-s-2 md:border-t-0 md:px-8 md:pe-0"
            >
              <MetricBar
                label="שביעות רצון התושבים"
                value={satisfactionPct ?? 0}
                display={
                  metrics.satisfactionAvg !== null
                    ? `${metrics.satisfactionAvg.toFixed(1)} / 5`
                    : '-'
                }
                caption={
                  metrics.satisfactionCount > 0
                    ? `${metrics.satisfactionCount.toLocaleString('he-IL')} תושבים דירגו`
                    : 'אין עדיין דירוגים. הדירוג נאסף בהרשמה'
                }
              />
            </div>
          </AnimateIn>
        </section>

        {/* Votes */}
        <section aria-label="הצבעות">
          <Tabs defaultValue={liveVotes.length > 0 ? 'live' : 'topics'} dir="rtl">
            <TabsList>
              <TabsTrigger value="live">
                הצבעות חיות
                <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                  {liveVotes.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="topics">
                נושאים על השולחן
                <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                  {openTopics.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="closed">
                סגורות
                <span className="ms-2 tabular-nums text-red group-data-[state=active]:text-paper">
                  {closedVotes.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live">
              <AnimateIn className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {liveVotes.map((vote) => (
                  <div key={vote.id} data-animate>
                    <VoteCard vote={vote} />
                  </div>
                ))}
              </AnimateIn>
              {liveVotes.length === 0 ? (
                <p className="border-2 border-dashed border-ink-soft p-6 font-mono text-sm text-ink-soft">
                  עדיין לא נקלטו קולות ב{name}. הנושאים הפתוחים מחכים בלשונית
                  «נושאים על השולחן».
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="topics">
              <AnimateIn className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {openTopics.map((vote) => (
                  <div key={vote.id} data-animate>
                    <TopicCard vote={vote} locale={locale} />
                  </div>
                ))}
              </AnimateIn>
              {openTopics.length === 0 ? (
                <p className="border-2 border-dashed border-ink-soft p-6 font-mono text-sm text-ink-soft">
                  אין כרגע נושאים פתוחים ב{name}.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="closed">
              <AnimateIn className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {closedVotes.map((vote) => (
                  <div key={vote.id} data-animate>
                    <VoteCard vote={vote} />
                  </div>
                ))}
              </AnimateIn>
              {closedVotes.length === 0 ? (
                <p className="border-2 border-dashed border-ink-soft p-6 font-mono text-sm text-ink-soft">
                  עוד לא נסגרו הצבעות ב{name}. התוצאות יופיעו כאן, שקופות לכולם.
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}
