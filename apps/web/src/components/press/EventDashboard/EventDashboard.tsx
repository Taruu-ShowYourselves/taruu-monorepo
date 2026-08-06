'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { animate, createScope, stagger } from 'animejs';
import type { Locale } from '@/lib/i18n';
import styles from './EventDashboard.module.css';
import { localePrefix } from '@/lib/i18n';

interface EventDashboardProps {
  locale?: Locale;
}

interface NetworkStats {
  activeVotes: number;
  totalVoters: number;
  municipalities: number;
}

interface RegistrationStats {
  registeredTotal: number;
}

interface VoteOption {
  id: string;
  label: string;
  voteCount: number;
}

interface LiveVote {
  id: string;
  title: string;
  municipality: string;
  participantCount: number;
  updatedAt: string;
  options: VoteOption[];
}

interface DashboardData {
  network: NetworkStats | null;
  registrations: RegistrationStats | null;
  votes: LiveVote[];
}

interface EventDashboardCopy {
  kicker: string;
  titleLead: string;
  titleEm: string;
  clockCaption: string;
  syncPrefix: string;
  connectingSources: string;
  metrics: {
    registered: { label: string; note: string };
    activeVotes: { label: string; note: string };
    verified: { label: string; note: string };
    municipalities: { label: string; note: string };
  };
  cityDesk: {
    index: string;
    title: string;
    live: string;
    topicsSuffix: string;
    empty: string;
  };
  leadingDesk: {
    index: string;
    title: string;
    participants: string;
    ballots: string;
    link: string;
    empty: string;
  };
  hotAgenda: {
    index: string;
    title: string;
    link: string;
    empty: string;
  };
  rail: {
    label: string;
    participantsSuffix: string;
    connecting: string;
    signals: string;
  };
}

const COPY: Record<Locale, EventDashboardCopy> = {
  he: {
    kicker: 'דאשבורד אירועים · LIVE CIVIC PULSE',
    titleLead: 'מה קורה עכשיו,',
    titleEm: 'בזמן אמת.',
    clockCaption: 'שעון ישראל · עדכון כל 30 שניות',
    syncPrefix: 'סנכרון',
    connectingSources: 'מתחבר למקורות החיים…',
    metrics: {
      registered: { label: 'תושבים רשומים', note: 'בכל הארץ' },
      activeVotes: { label: 'הצבעות פעילות', note: 'פתוחות עכשיו' },
      verified: { label: 'השתתפויות מאומתות', note: 'קול אחד לאדם' },
      municipalities: { label: 'רשויות פעילות', note: 'בדופק הארצי' },
    },
    cityDesk: {
      index: '01 / CITY RANK',
      title: 'דירוג הערים',
      live: 'LIVE',
      topicsSuffix: 'נושאים פעילים',
      empty: 'הדירוג מתעדכן עם כניסת הנתונים.',
    },
    leadingDesk: {
      index: '02 / LEADING VOTE',
      title: 'ההצבעה המובילה',
      participants: 'משתתפים',
      ballots: 'קולות',
      link: 'להצבעה החיה ←',
      empty: 'ההצבעה המובילה תופיע כאן.',
    },
    hotAgenda: {
      index: '03 / HOT AGENDA',
      title: 'חם עכשיו בסדר היום',
      link: 'לדסק הארצי ←',
      empty: 'הנושאים החמים מתעדכנים עכשיו.',
    },
    rail: {
      label: 'EVENT STREAM',
      participantsSuffix: 'משתתפים',
      connecting: 'מתחבר לזרם האירועים…',
      signals: 'SIGNALS',
    },
  },
  en: {
    kicker: 'Event Dashboard · LIVE CIVIC PULSE',
    titleLead: 'What is happening now,',
    titleEm: 'in real time.',
    clockCaption: 'Israel time · updates every 30 seconds',
    syncPrefix: 'Synced',
    connectingSources: 'Connecting to live sources…',
    metrics: {
      registered: { label: 'Registered residents', note: 'Nationwide' },
      activeVotes: { label: 'Active votes', note: 'Open now' },
      verified: { label: 'Verified participations', note: 'One vote per person' },
      municipalities: { label: 'Active municipalities', note: 'On the national pulse' },
    },
    cityDesk: {
      index: '01 / CITY RANK',
      title: 'City ranking',
      live: 'LIVE',
      topicsSuffix: 'active topics',
      empty: 'The ranking updates as data comes in.',
    },
    leadingDesk: {
      index: '02 / LEADING VOTE',
      title: 'The leading vote',
      participants: 'participants',
      ballots: 'ballots',
      link: 'To the live vote →',
      empty: 'The leading vote will appear here.',
    },
    hotAgenda: {
      index: '03 / HOT AGENDA',
      title: 'Hot on the agenda now',
      link: 'To the national desk →',
      empty: 'The hot topics are updating now.',
    },
    rail: {
      label: 'EVENT STREAM',
      participantsSuffix: 'participants',
      connecting: 'Connecting to the event stream…',
      signals: 'SIGNALS',
    },
  },
};

const EMPTY_DATA: DashboardData = {
  network: null,
  registrations: null,
  votes: [],
};

const formatNumber = (value: number | undefined) =>
  value === undefined ? '-' : value.toLocaleString('he-IL');

function totalBallots(vote: LiveVote) {
  return vote.options.reduce((sum, option) => sum + option.voteCount, 0);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

export function EventDashboard({ locale = 'he' }: EventDashboardProps) {
  const t = COPY[locale];
  const rootRef = useRef<HTMLElement>(null);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [eventIndex, setEventIndex] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const [networkResult, registrationsResult, votesResult] =
        await Promise.allSettled([
          fetch('/api/stats/network', {
            signal: controller.signal,
            cache: 'no-store',
          }).then((response) =>
            response.ok ? response.json() : Promise.reject(new Error('network stats'))
          ),
          fetch('/api/stats/registrations', {
            signal: controller.signal,
            cache: 'no-store',
          }).then((response) =>
            response.ok ? response.json() : Promise.reject(new Error('registration stats'))
          ),
          fetch('/api/votes?status=active&include=options', {
            signal: controller.signal,
            cache: 'no-store',
          }).then((response) =>
            response.ok ? response.json() : Promise.reject(new Error('active votes'))
          ),
        ]);

      if (controller.signal.aborted) return;

      setData((current) => ({
        network:
          networkResult.status === 'fulfilled'
            ? (networkResult.value.stats as NetworkStats)
            : current.network,
        registrations:
          registrationsResult.status === 'fulfilled'
            ? (registrationsResult.value.stats as RegistrationStats)
            : current.registrations,
        votes:
          votesResult.status === 'fulfilled'
            ? (votesResult.value.votes as LiveVote[])
            : current.votes,
      }));
      setLastSync(new Date());
    }

    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    return () => {
      window.clearInterval(poll);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data.votes.length < 2) return;
    const timer = window.setInterval(() => {
      setEventIndex((current) => (current + 1) % data.votes.length);
    }, 2700);
    return () => window.clearInterval(timer);
  }, [data.votes.length]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let scope: ReturnType<typeof createScope> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || scope) return;
        scope = createScope({ root }).add(() => {
          animate('[data-dashboard-rise]', {
            translateY: [22, 0],
            opacity: [0, 1],
            delay: stagger(52),
            duration: 620,
            ease: 'outExpo',
          });
          animate('[data-dashboard-rule]', {
            scaleX: [0, 1],
            duration: 900,
            ease: 'inOutExpo',
          });
        });
        observer.disconnect();
      },
      { threshold: 0.1 }
    );

    observer.observe(root);
    return () => {
      observer.disconnect();
      scope?.revert();
    };
  }, []);

  const liveEvents = useMemo(
    () =>
      [...data.votes].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [data.votes]
  );

  const activeEvent =
    liveEvents.length > 0 ? liveEvents[eventIndex % liveEvents.length] : undefined;

  const leadingVote = useMemo(
    () =>
      [...data.votes].sort(
        (a, b) =>
          b.participantCount - a.participantCount ||
          totalBallots(b) - totalBallots(a)
      )[0],
    [data.votes]
  );

  const cityRanking = useMemo(() => {
    const activity = new Map<string, { topics: number; participants: number }>();
    data.votes.forEach((vote) => {
      if (!vote.municipality || /כנסת|ארצי|ישראל/.test(vote.municipality)) return;
      const current = activity.get(vote.municipality) ?? {
        topics: 0,
        participants: 0,
      };
      current.topics += 1;
      current.participants += vote.participantCount;
      activity.set(vote.municipality, current);
    });

    return [...activity.entries()]
      .sort(
        (a, b) =>
          b[1].participants - a[1].participants ||
          b[1].topics - a[1].topics
      )
      .slice(0, 4);
  }, [data.votes]);

  const hotAgenda = useMemo(() => {
    const national = data.votes.filter((vote) =>
      /כנסת|ארצי|ישראל/.test(vote.municipality)
    );
    return (national.length > 0 ? national : data.votes).slice(0, 3);
  }, [data.votes]);

  const maxCityTopics = Math.max(1, ...cityRanking.map(([, rank]) => rank.topics));

  return (
    <section
      id="event-dashboard"
      ref={rootRef}
      className={styles.dashboard}
      aria-labelledby="event-dashboard-title"
    >
      <div className={styles.inner}>
        <header className={styles.header} data-dashboard-rise>
          <div className={styles.headerTitle}>
            <span className={styles.kicker}>
              <i aria-hidden />
              {t.kicker}
            </span>
            <h2 id="event-dashboard-title" className={styles.title}>
              {t.titleLead} <span>{t.titleEm}</span>
            </h2>
          </div>

          <div className={styles.clockDesk}>
            <time suppressHydrationWarning>{formatClock(clock)}</time>
            <span>{t.clockCaption}</span>
            <b>
              {lastSync
                ? `${t.syncPrefix} ${formatClock(lastSync)}`
                : t.connectingSources}
            </b>
          </div>
        </header>

        <div className={styles.heavyRule} data-dashboard-rule aria-hidden />

        <dl className={styles.metrics}>
          <div data-dashboard-rise>
            <dt>{t.metrics.registered.label}</dt>
            <dd>{formatNumber(data.registrations?.registeredTotal)}</dd>
            <span>{t.metrics.registered.note}</span>
          </div>
          <div data-dashboard-rise>
            <dt>{t.metrics.activeVotes.label}</dt>
            <dd>{formatNumber(data.network?.activeVotes)}</dd>
            <span>{t.metrics.activeVotes.note}</span>
          </div>
          <div data-dashboard-rise>
            <dt>{t.metrics.verified.label}</dt>
            <dd>{formatNumber(data.network?.totalVoters)}</dd>
            <span>{t.metrics.verified.note}</span>
          </div>
          <div data-dashboard-rise>
            <dt>{t.metrics.municipalities.label}</dt>
            <dd>{formatNumber(data.network?.municipalities)}</dd>
            <span>{t.metrics.municipalities.note}</span>
          </div>
        </dl>

        <div className={styles.dashboardGrid}>
          <article className={styles.cityDesk} data-dashboard-rise>
            <header className={styles.panelHeader}>
              <div>
                <span>{t.cityDesk.index}</span>
                <h3>{t.cityDesk.title}</h3>
              </div>
              <span className={styles.liveFlag}><i />{t.cityDesk.live}</span>
            </header>

            {cityRanking.length > 0 ? (
              <ol className={styles.cityList}>
                {cityRanking.map(([city, rank], index) => (
                  <li
                    className={
                      activeEvent?.municipality === city ? styles.cityActive : undefined
                    }
                    key={city}
                  >
                    <span className={styles.rankNumber}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className={styles.cityCopy}>
                      <b>{city}</b>
                      <span>{rank.topics} {t.cityDesk.topicsSuffix}</span>
                      <i
                        aria-hidden
                        style={{
                          inlineSize: `${Math.max(
                            12,
                            (rank.topics / maxCityTopics) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{formatNumber(rank.participants)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>{t.cityDesk.empty}</p>
            )}
          </article>

          <article className={styles.leadingDesk} data-dashboard-rise>
            <header className={styles.panelHeader}>
              <div>
                <span>{t.leadingDesk.index}</span>
                <h3>{t.leadingDesk.title}</h3>
              </div>
            </header>

            {leadingVote ? (
              <div className={styles.leadingBody}>
                <span className={styles.municipality}>
                  {leadingVote.municipality}
                </span>
                <h3>{leadingVote.title}</h3>

                <div className={styles.voteMeta}>
                  <span>
                    <b>{formatNumber(leadingVote.participantCount)}</b>
                    {t.leadingDesk.participants}
                  </span>
                  <span>
                    <b>{formatNumber(totalBallots(leadingVote))}</b>
                    {t.leadingDesk.ballots}
                  </span>
                </div>

                <Link
                  href={`${localePrefix(locale)}/votes/${leadingVote.id}`}
                  className={styles.voteLink}
                >
                  {t.leadingDesk.link}
                </Link>
              </div>
            ) : (
              <p className={styles.empty}>{t.leadingDesk.empty}</p>
            )}
          </article>
        </div>

        <section className={styles.hotAgenda} data-dashboard-rise>
          <header>
            <div>
              <span>{t.hotAgenda.index}</span>
              <h3>{t.hotAgenda.title}</h3>
            </div>
            <Link href={`${localePrefix(locale)}/knesset`}>{t.hotAgenda.link}</Link>
          </header>

          <ol>
            {hotAgenda.length > 0 ? (
              hotAgenda.map((vote, index) => (
                <li key={vote.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Link href={`${localePrefix(locale)}/votes/${vote.id}`}>{vote.title}</Link>
                  <b>{vote.municipality}</b>
                </li>
              ))
            ) : (
              <li className={styles.empty}>{t.hotAgenda.empty}</li>
            )}
          </ol>
        </section>

        <aside className={styles.liveRail} aria-live="polite">
          <span className={styles.railLabel}><i />{t.rail.label}</span>
          {activeEvent ? (
            <div
              className={styles.liveEvent}
              key={`${activeEvent.id}-${eventIndex}`}
            >
              <time suppressHydrationWarning>{formatClock(clock)}</time>
              <b>{activeEvent.municipality}</b>
              <strong>{activeEvent.title}</strong>
              <span>{formatNumber(activeEvent.participantCount)} {t.rail.participantsSuffix}</span>
            </div>
          ) : (
            <div className={styles.liveEvent}>
              <strong>{t.rail.connecting}</strong>
            </div>
          )}
          <span className={styles.railCount}>
            {liveEvents.length.toString().padStart(2, '0')} {t.rail.signals}
          </span>
        </aside>
      </div>
    </section>
  );
}
