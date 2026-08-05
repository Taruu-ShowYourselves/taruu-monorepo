'use client';

import { Fragment, useEffect, useState } from 'react';
import styles from './Countdown.module.css';

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

const UNITS = [
  ['days', 'ימים'],
  ['hours', 'שעות'],
  ['minutes', 'דקות'],
  ['seconds', 'שניות'],
] as const;

interface CountdownClockProps {
  className?: string;
}

/**
 * The digits row alone - mono tabular digits with Hebrew unit labels,
 * inheriting the surrounding text color so it reads on paper and ink alike.
 * Renders nothing once the launch has passed.
 */
export function CountdownClock({ className }: CountdownClockProps) {
  const remaining = useCountdown();

  if (remaining === null) return null;

  return (
    <div
      className={className ? `${styles.clock} ${className}` : styles.clock}
      dir="ltr"
      role="timer"
    >
      {UNITS.map(([key, label], i) => (
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
            <span className={styles.unitLabel}>{label}</span>
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
export function Countdown() {
  const remaining = useCountdown();
  const live = remaining === null;

  return (
    <section className={styles.countdown} aria-label="ספירה לאחור לפתיחה הארצית">
      <div className={styles.inner}>
        <div className={styles.label}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.tick} />
            הפתיחה הארצית · LAUNCH
          </span>
        </div>

        {live ? (
          <span className={styles.liveFlag}>ההצבעה פתוחה · LIVE</span>
        ) : (
          <CountdownClock />
        )}
      </div>
    </section>
  );
}
