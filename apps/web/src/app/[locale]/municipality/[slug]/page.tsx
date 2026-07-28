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
import { Badge } from '@/components/uikit/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/uikit/card';
import { MetricBar } from '@/components/uikit/metric-bar';
import { Progress } from '@/components/uikit/progress';
import { Separator } from '@/components/uikit/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/uikit/tabs';
import type { Locale } from '@/lib/i18n';

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
    title: `${name} — פרופיל רשות | תַּרְאוּ`,
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
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} דק׳`;
  if (hours < 48) return `${Math.round(hours)} שע׳`;
  return `${Math.round(hours / 24)} ימים`;
}

function VoteCard({ vote }: { vote: MunicipalityVoteSummary }) {
  const closed = vote.status === 'ended';
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{vote.title}</CardTitle>
        <div className="flex items-center gap-2">
          {closed && vote.winningOption ? (
            <Badge variant="red">הוכרע: {vote.winningOption}</Badge>
          ) : null}
          <Badge variant={closed ? 'soft' : 'default'}>
            {closed ? 'סגורה' : 'פתוחה · LIVE'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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

        <Separator className="bg-paper-edge" />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-faint">
          <span>{vote.totalBallots.toLocaleString('he-IL')} קולות מאומתים</span>
          <span>נפתחה {formatDate(vote.startDate)}</span>
          <span>{closed ? 'נסגרה' : 'נסגרת'} {formatDate(vote.endDate)}</span>
        </div>
      </CardContent>
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

  // Degrade to the empty state rather than a 500 — the page's "no data yet"
  // copy is honest for both an unreachable DB and a genuinely empty one.
  const { metrics, openVotes, closedVotes } = await getMunicipalityProfile(
    name
  ).catch((error) => {
    logger.error('municipality profile unavailable', { error, name });
    return EMPTY_PROFILE;
  });

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
      <main className="mx-auto flex w-full max-w-[var(--np-container)] flex-col gap-8 px-[var(--np-gutter)] py-8">
        {/* Dateline header */}
        <header className="flex flex-col gap-3">
          <span className="flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-widest text-red">
            <span aria-hidden className="inline-block size-[0.7em] bg-red" />
            פרופיל רשות · MUNICIPALITY
          </span>
          <h1 className="font-display text-5xl font-black leading-none tracking-tight">
            {name}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {metrics.residents.toLocaleString('he-IL')} תושבים רשומים
            </Badge>
            <Badge variant="outline">
              {metrics.participants.toLocaleString('he-IL')} מצביעים
            </Badge>
            <Badge variant="outline">
              {openVotes.length} הצבעות פתוחות
            </Badge>
          </div>
        </header>

        <Separator />

        {/* Civic metrics */}
        <section aria-label="מדדי הרשות">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent>
                <MetricBar
                  label="מעורבות אזרחית"
                  value={engagementPct ?? 0}
                  display={engagementPct !== null ? `${engagementPct}%` : '—'}
                  caption={
                    engagementPct !== null
                      ? `${metrics.participants.toLocaleString('he-IL')} מצביעים מתוך ${metrics.residents.toLocaleString('he-IL')} תושבים רשומים`
                      : 'אין עדיין נתוני הצבעה'
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <MetricBar
                  label="זמן עד הצבעה"
                  value={timeBarValue ?? 0}
                  display={
                    metrics.avgTimeToEngageHours !== null
                      ? formatHours(metrics.avgTimeToEngageHours)
                      : '—'
                  }
                  caption={
                    metrics.avgTimeToEngageHours !== null
                      ? 'ממוצע מפתיחת הצבעה ועד מתן הקול'
                      : 'אין עדיין נתוני הצבעה'
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <MetricBar
                  label="שביעות רצון התושבים"
                  value={satisfactionPct ?? 0}
                  display={
                    metrics.satisfactionAvg !== null
                      ? `${metrics.satisfactionAvg.toFixed(1)} / 5`
                      : '—'
                  }
                  caption={
                    metrics.satisfactionCount > 0
                      ? `${metrics.satisfactionCount.toLocaleString('he-IL')} תושבים דירגו`
                      : 'אין עדיין דירוגים — הדירוג נאסף בהרשמה'
                  }
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Votes */}
        <section aria-label="הצבעות">
          <Tabs defaultValue="open" dir="rtl">
            <TabsList>
              <TabsTrigger value="open">
                פתוחות ({openVotes.length})
              </TabsTrigger>
              <TabsTrigger value="closed">
                סגורות ({closedVotes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {openVotes.map((vote) => (
                  <VoteCard key={vote.id} vote={vote} />
                ))}
              </div>
              {openVotes.length === 0 ? (
                <p className="border-2 border-ink bg-paper-box p-6 font-mono text-sm text-ink-soft">
                  אין כרגע הצבעות פתוחות ב{name}. ההצבעה הראשונה נפתחת 04.08.26.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="closed">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {closedVotes.map((vote) => (
                  <VoteCard key={vote.id} vote={vote} />
                ))}
              </div>
              {closedVotes.length === 0 ? (
                <p className="border-2 border-ink bg-paper-box p-6 font-mono text-sm text-ink-soft">
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
