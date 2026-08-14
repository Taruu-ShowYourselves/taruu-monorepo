'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ISRAEL_MAP_PATH,
  MAP_VIEWBOX,
} from '@/components/press/CinematicIntro/israel-map';
import { municipalityHref } from '@/components/uikit/municipality-link';
import { chime } from '@/lib/feedback/chime';
import type { Locale } from '@/lib/i18n';
import styles from './IsraelMapDesk.module.css';

/** One municipality on the map: place, weight, and its open topics. */
export interface MapPin {
  name: string;
  x: number;
  y: number;
  /** Hottest topic's 0-100 heat - drives the pulse and the default pick. */
  heat: number;
  count: number;
  /** Hottest-first topic headlines, capped server-side. */
  topics: string[];
}

interface MapCopy {
  kicker: string;
  headline: string;
  standfirst: string;
  legendPin: string;
  topicsUnit: (count: number) => string;
  deskLink: string;
  deskGlyph: string;
  empty: string;
  listLabel: string;
  mapAria: string;
}

const COPY: Record<Locale, MapCopy> = {
  he: {
    kicker: 'המפה החיה · THE LIVE MAP',
    headline: 'מה מעסיק את הארץ עכשיו',
    standfirst:
      'כל נושא פתוח, נעוץ ביישוב שהוא שייך לו. בחרו עיר על המפה - ותראו מה על שולחנה.',
    legendPin: 'גודל הסיכה - מספר הנושאים הפתוחים',
    topicsUnit: (count) => (count === 1 ? 'נושא פתוח' : `${count} נושאים פתוחים`),
    deskLink: 'לדסק של',
    deskGlyph: '←',
    empty: 'אין כרגע נושאים פתוחים על המפה. ההצבעה הראשונה תדליק אותה.',
    listLabel: 'היישובים הפעילים, לפי חום ציבורי',
    mapAria: 'מפת ישראל עם כל הנושאים הפתוחים לפי יישוב',
  },
  en: {
    kicker: 'THE LIVE MAP',
    headline: 'What the country is busy with',
    standfirst:
      'Every open topic, pinned to the town it belongs to. Pick a city on the map to see what is on its table.',
    legendPin: 'Pin size - number of open topics',
    topicsUnit: (count) => (count === 1 ? 'open topic' : `${count} open topics`),
    deskLink: 'To the desk of',
    deskGlyph: '→',
    empty: 'No open topics on the map right now. The first ballot lights it up.',
    listLabel: 'Active towns, by public heat',
    mapAria: 'Map of Israel with every open topic by town',
  },
};

/** Pin radius from topic count: legible floor, capped so Tel Aviv cannot eclipse the Galilee. */
const pinRadius = (count: number) => 4.5 + Math.min(6, count * 1.5);

export function IsraelMapDeskClient({
  locale = 'he',
  pins,
}: {
  locale?: Locale;
  pins: MapPin[];
}) {
  const t = COPY[locale];
  /* Hottest town is pre-selected: the map opens saying something instead of
     waiting to be asked. */
  const [active, setActive] = useState<string | null>(pins[0]?.name ?? null);
  const current = pins.find((p) => p.name === active) ?? pins[0] ?? null;

  const pick = (name: string) => {
    if (name === active) return;
    chime('tick');
    setActive(name);
  };

  return (
    <section
      className={styles.section}
      aria-labelledby="israel-map-headline"
      data-nav-reveal=""
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="israel-map-headline" className={styles.headline}>
            {t.headline}
          </h2>
          <p className={styles.standfirst}>{t.standfirst}</p>
        </header>

        {pins.length === 0 ? (
          <p className={styles.empty}>{t.empty}</p>
        ) : (
          <div className={styles.board}>
            <div className={styles.mapWrap}>
              <svg
                className={styles.map}
                viewBox={MAP_VIEWBOX}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={t.mapAria}
              >
                <path className={styles.outline} d={ISRAEL_MAP_PATH} />
                {pins.map((pin) => (
                  <g
                    key={pin.name}
                    className={styles.pin}
                    data-active={pin.name === active || undefined}
                    transform={`translate(${pin.x} ${pin.y})`}
                  >
                    {/* The hit area is a generous invisible disc: the visible
                        pin can be 5px on a phone, a fingertip is not. */}
                    <circle
                      className={styles.pinHit}
                      r={16}
                      onClick={() => pick(pin.name)}
                    />
                    <circle
                      className={styles.pinHalo}
                      r={pinRadius(pin.count) + 4}
                    />
                    <circle
                      className={styles.pinCore}
                      r={pinRadius(pin.count)}
                    />
                  </g>
                ))}
              </svg>
              <p className={styles.legend} aria-hidden>
                <span className={styles.legendDot} /> {t.legendPin}
              </p>
            </div>

            <div className={styles.ledger}>
              {/* The chosen town's docket. aria-live so a keyboard reader
                  hears the selection change the panel. */}
              <div className={styles.docket} aria-live="polite">
                {current ? (
                  <>
                    <h3 className={styles.docketTown}>
                      <span key={current.name} className={styles.docketName}>
                        {current.name}
                      </span>
                      <span className={styles.docketCount}>
                        {t.topicsUnit(current.count)}
                      </span>
                    </h3>
                    <ol className={styles.docketList}>
                      {current.topics.map((title) => (
                        <li key={title} className={styles.docketItem}>
                          {title}
                        </li>
                      ))}
                    </ol>
                    <Link
                      className={styles.deskLink}
                      href={municipalityHref(current.name, locale)}
                    >
                      {t.deskLink} {current.name}{' '}
                      <span aria-hidden>{t.deskGlyph}</span>
                    </Link>
                  </>
                ) : null}
              </div>

              <nav className={styles.townList} aria-label={t.listLabel}>
                {pins.slice(0, 10).map((pin) => (
                  <button
                    key={pin.name}
                    type="button"
                    className={styles.townRow}
                    data-active={pin.name === active || undefined}
                    onClick={() => pick(pin.name)}
                  >
                    <span className={styles.townName}>{pin.name}</span>
                    <span className={styles.townCount}>
                      {t.topicsUnit(pin.count)}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
