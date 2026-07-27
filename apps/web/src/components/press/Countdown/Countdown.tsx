'use client';

import { useEffect, useState } from 'react';
import styles from './Countdown.module.css';

/** National grand opening — 04.08.26, midnight Israel time (IDT, UTC+3). */
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
 * Grand-opening countdown strip — press furniture. Ink band, mono digits,
 * ticks once a second. Mount-gated so the server renders a stable shell and
 * the digits only appear on the client (no hydration drift).
 */
export function Countdown() {
  const [remaining, setRemaining] = useState<Remaining | null | 'pending'>('pending');

  useEffect(() => {
    const tick = () => setRemaining(remainingUntilLaunch(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const live = remaining === null;

  return (
    <section className={styles.countdown} aria-label="ספירה לאחור לפתיחה הארצית">
      <div className={styles.inner}>
        <div className={styles.label}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.tick} />
            הפתיחה הארצית · LAUNCH
          </span>
          <span className={styles.date}>04.08.26 · כל הארץ, בבת אחת</span>
        </div>

        {live ? (
          <span className={styles.liveFlag}>ההצבעה פתוחה · LIVE</span>
        ) : (
          <div className={styles.clock} dir="ltr" role="timer">
            {(
              [
                ['days', 'ימים'],
                ['hours', 'שעות'],
                ['minutes', 'דקות'],
                ['seconds', 'שניות'],
              ] as const
            ).map(([key, label], i) => (
              <span key={key} className={styles.unit}>
                {i > 0 && (
                  <span className={styles.sep} aria-hidden>
                    :
                  </span>
                )}
                <span className={styles.digits} suppressHydrationWarning>
                  {remaining === 'pending' ? '--' : pad(remaining[key])}
                </span>
                <span className={styles.unitLabel}>{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
