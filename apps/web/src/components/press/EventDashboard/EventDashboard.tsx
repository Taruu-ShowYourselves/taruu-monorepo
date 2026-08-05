'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { animate, createScope, stagger } from 'animejs';
import type { Locale } from '@/lib/i18n';
import styles from './EventDashboard.module.css';

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
              דאשבורד אירועים · LIVE CIVIC PULSE
            </span>
            <h2 id="event-dashboard-title" className={styles.title}>
              מה קורה עכשיו, <span>בזמן אמת.</span>
            </h2>
          </div>

          <div className={styles.clockDesk}>
            <time suppressHydrationWarning>{formatClock(clock)}</time>
            <span>שעון ישראל · עדכון כל 30 שניות</span>
            <b>
              {lastSync
                ? `סנכרון ${formatClock(lastSync)}`
                : 'מתחבר למקורות החיים…'}
            </b>
          </div>
        </header>

        <div className={styles.heavyRule} data-dashboard-rule aria-hidden />

        <dl className={styles.metrics}>
          <div data-dashboard-rise>
            <dt>תושבים רשומים</dt>
            <dd>{formatNumber(data.registrations?.registeredTotal)}</dd>
            <span>בכל הארץ</span>
          </div>
          <div data-dashboard-rise>
            <dt>הצבעות פעילות</dt>
            <dd>{formatNumber(data.network?.activeVotes)}</dd>
            <span>פתוחות עכשיו</span>
          </div>
          <div data-dashboard-rise>
            <dt>השתתפויות מאומתות</dt>
            <dd>{formatNumber(data.network?.totalVoters)}</dd>
            <span>קול אחד לאדם</span>
          </div>
          <div data-dashboard-rise>
            <dt>רשויות פעילות</dt>
            <dd>{formatNumber(data.network?.municipalities)}</dd>
            <span>בדופק הארצי</span>
          </div>
        </dl>

        <div className={styles.dashboardGrid}>
          <article className={styles.cityDesk} data-dashboard-rise>
            <header className={styles.panelHeader}>
              <div>
                <span>01 / CITY RANK</span>
                <h3>דירוג הערים</h3>
              </div>
              <span className={styles.liveFlag}><i />LIVE</span>
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
                      <span>{rank.topics} נושאים פעילים</span>
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
              <p className={styles.empty}>הדירוג מתעדכן עם כניסת הנתונים.</p>
            )}
          </article>

          <article className={styles.leadingDesk} data-dashboard-rise>
            <header className={styles.panelHeader}>
              <div>
                <span>02 / LEADING VOTE</span>
                <h3>ההצבעה המובילה</h3>
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
                    משתתפים
                  </span>
                  <span>
                    <b>{formatNumber(totalBallots(leadingVote))}</b>
                    קולות
                  </span>
                </div>

                <Link
                  href={`/${locale}/votes/${leadingVote.id}`}
                  className={styles.voteLink}
                >
                  להצבעה החיה ←
                </Link>
              </div>
            ) : (
              <p className={styles.empty}>ההצבעה המובילה תופיע כאן.</p>
            )}
          </article>
        </div>

        <section className={styles.hotAgenda} data-dashboard-rise>
          <header>
            <div>
              <span>03 / HOT AGENDA</span>
              <h3>חם עכשיו בסדר היום</h3>
            </div>
            <Link href={`/${locale}/knesset`}>לדסק הארצי ←</Link>
          </header>

          <ol>
            {hotAgenda.length > 0 ? (
              hotAgenda.map((vote, index) => (
                <li key={vote.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Link href={`/${locale}/votes/${vote.id}`}>{vote.title}</Link>
                  <b>{vote.municipality}</b>
                </li>
              ))
            ) : (
              <li className={styles.empty}>הנושאים החמים מתעדכנים עכשיו.</li>
            )}
          </ol>
        </section>

        <aside className={styles.liveRail} aria-live="polite">
          <span className={styles.railLabel}><i />EVENT STREAM</span>
          {activeEvent ? (
            <div
              className={styles.liveEvent}
              key={`${activeEvent.id}-${eventIndex}`}
            >
              <time suppressHydrationWarning>{formatClock(clock)}</time>
              <b>{activeEvent.municipality}</b>
              <strong>{activeEvent.title}</strong>
              <span>{formatNumber(activeEvent.participantCount)} משתתפים</span>
            </div>
          ) : (
            <div className={styles.liveEvent}>
              <strong>מתחבר לזרם האירועים…</strong>
            </div>
          )}
          <span className={styles.railCount}>
            {liveEvents.length.toString().padStart(2, '0')} SIGNALS
          </span>
        </aside>
      </div>
    </section>
  );
}
