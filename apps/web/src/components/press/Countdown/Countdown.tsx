'use client';

import { Fragment, useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import styles from './Countdown.module.css';

interface CountdownCopy {
  unitLabels: Record<'days' | 'hours' | 'minutes' | 'seconds', string>;
  sectionAria: string;
  kicker: string;
  liveFlag: string;
}

const COPY: Record<Locale, CountdownCopy> = {
  he: {
    unitLabels: {
      days: 'ימים',
      hours: 'שעות',
      minutes: 'דקות',
      seconds: 'שניות',
    },
    sectionAria: 'ספירה לאחור לפתיחה הארצית',
    kicker: 'הפתיחה הארצית · LAUNCH',
    liveFlag: 'ההצבעה פתוחה · LIVE',
  },
  en: {
    unitLabels: {
      days: 'days',
      hours: 'hours',
      minutes: 'minutes',
      seconds: 'seconds',
    },
    sectionAria: 'Countdown to the national launch',
    kicker: 'The national launch',
    liveFlag: 'Voting is open · LIVE',
  },
};

/** National grand opening - 04.08.26, midnight Israel time (IDT, UTC+3). */
const LAUNCH_AT = Date.parse('2026-08-04T00:00:00+03:00');

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntilLaunch(now: number): Remaining | null {
  const delta = LAUNCH_AT - now;
  if (delta <= 0) return null;
  const totalSeconds = Math.floor(delta / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ticks once a second toward the launch moment. Starts as 'pending' so the
 * server renders a stable shell and the digits only appear on the client
 * (no hydration drift). Resolves to null once the launch has passed.
 */
export function useCountdown(): Remaining | null | 'pending' {
  const [remaining, setRemaining] = useState<Remaining | null | 'pending'>('pending');

  useEffect(() => {
    const tick = () => setRemaining(remainingUntilLaunch(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

interface CountdownClockProps {
  className?: string;
  locale?: Locale;
}

/**
 * The digits row alone - mono tabular digits with Hebrew unit labels,
 * inheriting the surrounding text color so it reads on paper and ink alike.
 * Renders nothing once the launch has passed.
 */
export function CountdownClock({ className, locale = 'he' }: CountdownClockProps) {
  const remaining = useCountdown();
  const t = COPY[locale];

  if (remaining === null) return null;

  return (
    <div
      className={className ? `${styles.clock} ${className}` : styles.clock}
      dir="ltr"
      role="timer"
    >
      {UNITS.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && (
            <span className={styles.sep} aria-hidden>
              :
            </span>
          )}
          <span className={styles.unit}>
            <span className={styles.digits} suppressHydrationWarning>
              {remaining === 'pending' ? '--' : pad(remaining[key])}
            </span>
            <span className={styles.unitLabel}>{t.unitLabels[key]}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Grand-opening countdown strip - press furniture. Full-width band under the
 * ticker: launch kicker, date stamp and the live clock.
 */
export function Countdown({ locale = 'he' }: { locale?: Locale }) {
  const remaining = useCountdown();
  const live = remaining === null;
  const t = COPY[locale];

  return (
    <section className={styles.countdown} aria-label={t.sectionAria}>
      <div className={styles.inner}>
        <div className={styles.label}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.tick} />
            {t.kicker}
          </span>
        </div>

        {live ? (
          <span className={styles.liveFlag}>{t.liveFlag}</span>
        ) : (
          <CountdownClock locale={locale} />
        )}
      </div>
    </section>
  );
}
