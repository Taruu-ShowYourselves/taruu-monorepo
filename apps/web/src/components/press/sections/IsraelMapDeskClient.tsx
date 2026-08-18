'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MUNICIPALITY_GEO } from '@sync/shared';
import {
  ISRAEL_MAP_PATH,
  MAP_VIEWBOX,
} from '@/components/press/CinematicIntro/israel-map';
import { municipalityHref } from '@/components/uikit/municipality-link';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { chime } from '@/lib/feedback/chime';
import type { Locale } from '@/lib/i18n';
import {
  MAP_TAP_RADIUS_PX,
  mapPointFromClient,
  nearestPinWithin,
} from './mapPinHit';
import styles from './IsraelMapDesk.module.css';

/** One municipality on the map: place, weight, and its open topics. */
export interface MapPin {
  name: string;
  x: number;
  y: number;
  /** Hottest topic's 0-100 heat - drives the pulse and the default pick. */
  heat: number;
  count: number;
  /** Hottest-first topic headlines with their ballot tallies, capped server-side. */
  topics: { title: string; ballots: number }[];
}

/** Platform-wide aggregates printed as the section's figures. */
export interface MapStats {
  signups: number;
  topics: number;
  towns: number;
  ballots: number;
}

interface MapCopy {
  kicker: string;
  headline: string;
  standfirst: string;
  figSignups: string;
  figTopics: string;
  figTowns: string;
  figBallots: string;
  legendPin: string;
  topicsUnit: (count: number) => string;
  ballotsUnit: (count: string) => string;
  deskLink: string;
  deskGlyph: string;
  empty: string;
  listLabel: string;
  mapAria: string;
}

const COPY: Record<Locale, MapCopy> = {
  he: {
    kicker: 'המפה החיה · THE LIVE MAP',
    headline: 'מה פתוח להצבעה בכל יישוב',
    standfirst:
      'כל נושא פתוח, נעוץ ביישוב שהוא שייך לו. בחרו עיר על המפה - ותראו מה על שולחנה.',
    figSignups: 'אזרחים כבר נרשמו',
    figTopics: 'נושאים פתוחים',
    figTowns: 'יישובים פעילים',
    figBallots: 'קולות נספרו',
    legendPin: 'גודל הסיכה - מספר הנושאים הפתוחים',
    topicsUnit: (count) => (count === 1 ? 'נושא פתוח' : `${count} נושאים פתוחים`),
    ballotsUnit: (count) => `${count} קולות`,
    deskLink: 'לדסק של',
    deskGlyph: '←',
    empty: 'אין כרגע נושאים פתוחים על המפה. ההצבעה הראשונה תדליק אותה.',
    listLabel: 'היישובים הפעילים, לפי חום ציבורי',
    mapAria: 'מפת ישראל עם כל הנושאים הפתוחים לפי יישוב',
  },
  en: {
    kicker: 'THE LIVE MAP',
    headline: 'What is open to vote in every town',
    standfirst:
      'Every open topic, pinned to the town it belongs to. Pick a city on the map to see what is on its table.',
    figSignups: 'civilians already signed up',
    figTopics: 'open topics',
    figTowns: 'active towns',
    figBallots: 'ballots counted',
    legendPin: 'Pin size - number of open topics',
    topicsUnit: (count) => (count === 1 ? 'open topic' : `${count} open topics`),
    ballotsUnit: (count) => `${count} ballots`,
    deskLink: 'To the desk of',
    deskGlyph: '→',
    empty: 'No open topics on the map right now. The first ballot lights it up.',
    listLabel: 'Active towns, by public heat',
    mapAria: 'Map of Israel with every open topic by town',
  },
};

/** Pin radius from topic count: legible floor, capped so Tel Aviv cannot eclipse the Galilee. */
const pinRadius = (count: number) => 4.5 + Math.min(6, count * 1.5);

/**
 * A figure that counts itself up the first time the section is seen. A
 * number that lands mid-flight reads as live in a way a static one never
 * does; under reduced motion it simply prints.
 */
function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const DURATION = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return value;
}

/** Roster entry for a town, by canonical name or any alias the reader typed. */
const geoOf = (name: string) =>
  MUNICIPALITY_GEO.find(
    (entry) => entry.name === name || entry.aliases.includes(name)
  );

/**
 * The town the map should open on for this reader: their own town when it
 * has open topics, otherwise the active town nearest to home. Squared
 * equirectangular distance - ordering is all that matters at this scale.
 */
function homePick(pins: MapPin[]): string | null {
  const home = getStoredMunicipality();
  if (!home) return null;
  if (pins.some((pin) => pin.name === home)) return home;

  const homeGeo = geoOf(home);
  if (!homeGeo) return null;
  const stretch = Math.cos((homeGeo.lat * Math.PI) / 180);

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const pin of pins) {
    const pinGeo = geoOf(pin.name);
    if (!pinGeo) continue;
    const dLat = pinGeo.lat - homeGeo.lat;
    const dLng = (pinGeo.lng - homeGeo.lng) * stretch;
    const distance = dLat * dLat + dLng * dLng;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = pin.name;
    }
  }
  return best;
}

export function IsraelMapDeskClient({
  locale = 'he',
  pins,
  stats,
}: {
  locale?: Locale;
  pins: MapPin[];
  stats: MapStats;
}) {
  const t = COPY[locale];
  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB');
  /* Hottest town pre-renders (the server knows no reader), then the mount
     effect walks it home: the reader's own town if it has open topics,
     otherwise the active town nearest to it. A hand on the map outranks
     both - once the reader picks, the map stops following the locality. */
  const [active, setActive] = useState<string | null>(pins[0]?.name ?? null);
  const userPicked = useRef(false);
  const current = pins.find((p) => p.name === active) ?? pins[0] ?? null;

  /* The section arms after mount and fires once it is properly on screen:
     the reveal stagger and the counting figures wait for a reader. Without
     JS neither attribute lands and everything simply prints. */
  const sectionRef = useRef<HTMLElement | null>(null);
  /* Debounce handle for the reading column's scroll glow (see below). */
  const scrollGlow = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    setArmed(true);
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setSeen(true);
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const liveSignups = useCountUp(stats.signups, seen);
  const liveTopics = useCountUp(stats.topics, seen);
  const liveTowns = useCountUp(stats.towns, seen);
  const liveBallots = useCountUp(stats.ballots, seen);

  useEffect(() => {
    const follow = () => {
      if (userPicked.current) return;
      const home = homePick(pins);
      if (home) setActive(home);
    };
    follow();
    /* The locality desk sits right above this section: change your town
       there and the map turns to look at it. */
    window.addEventListener(LOCALITY_EVENT, follow);
    return () => window.removeEventListener(LOCALITY_EVENT, follow);
  }, [pins]);

  const pick = (name: string) => {
    if (name === active) return;
    userPicked.current = true;
    chime('tick');
    setActive(name);
  };

  /* The map answers a tap with the town nearest to it, not with the town
     drawn last. Israel is small and the pins are placed by geography: Bat
     Yam and Holon land under three pixels apart on a phone, so per-pin hit
     discs overlap and SVG breaks the tie by paint order - which put the
     busiest town, drawn first, underneath every other pin in Gush Dan. The
     whole decision is made here from the pointer's own position, in map
     units, against a fingertip-sized radius measured off the live drawing
     (so the target stays ~44px on a phone and on a desk without the pins
     growing). Taps that land nowhere near a town choose nothing. */
  const pickNearest = (event: React.MouseEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const mapped = mapPointFromClient(matrix, event.clientX, event.clientY);
    if (!mapped) return;
    const hit = nearestPinWithin(
      pins,
      mapped.point,
      MAP_TAP_RADIUS_PX / mapped.pxPerUnit
    );
    if (hit) pick(hit.name);
  };

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="israel-map-headline"
      data-armed={armed || undefined}
      data-seen={seen || undefined}
    >
      {/* One spread: the country at full height on the far column, the
          reading matter - head, figures, the chosen town's docket and the
          ranked list - in a single editorial column beside it. */}
      <div className={styles.inner}>
        {/* data-lenis-prevent: the column scrolls inside itself, and the
            page's smooth-scroll otherwise swallows the wheel over it.
            data-scrolling (stamped here, capture phase so the docket's own
            scroll counts too) lights the red rail while the reading moves;
            the stylesheet clears it back to bare paper 700ms after. */}
        <div
          className={styles.column}
          data-lenis-prevent
          onScrollCapture={(event) => {
            const column = event.currentTarget;
            column.setAttribute('data-scrolling', '');
            if (scrollGlow.current) window.clearTimeout(scrollGlow.current);
            scrollGlow.current = window.setTimeout(
              () => column.removeAttribute('data-scrolling'),
              700,
            );
          }}
        >
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

          {/* One ruled line of ledger figures - the recruitment count the
              reader just became part of leads it, in red. Each counts itself
              up the first time the section is seen. */}
          <dl className={styles.figures}>
            <div className={styles.figure}>
              <dd className={`${styles.figureNum} ${styles.figureNumRed}`}>
                {fmt.format(seen ? liveSignups : stats.signups)}
              </dd>
              <dt className={styles.figureLabel}>{t.figSignups}</dt>
            </div>
            <div className={styles.figure}>
              <dd className={styles.figureNum}>
                {fmt.format(seen ? liveTopics : stats.topics)}
              </dd>
              <dt className={styles.figureLabel}>{t.figTopics}</dt>
            </div>
            <div className={styles.figure}>
              <dd className={styles.figureNum}>
                {fmt.format(seen ? liveTowns : stats.towns)}
              </dd>
              <dt className={styles.figureLabel}>{t.figTowns}</dt>
            </div>
            {/* A bold zero is a countdown that never started - the ballots
                figure earns its place only once someone has voted. */}
            {stats.ballots > 0 ? (
              <div className={styles.figure}>
                <dd className={styles.figureNum}>
                  {fmt.format(seen ? liveBallots : stats.ballots)}
                </dd>
                <dt className={styles.figureLabel}>{t.figBallots}</dt>
              </div>
            ) : null}
          </dl>

          {pins.length === 0 ? (
            <p className={styles.empty}>{t.empty}</p>
          ) : (
            <>
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
                      {current.topics.map((topic) => (
                        <li key={topic.title} className={styles.docketItem}>
                          <span className={styles.docketTitle}>
                            {topic.title}
                          </span>
                          {topic.ballots > 0 ? (
                            <strong className={styles.docketBallots}>
                              {t.ballotsUnit(fmt.format(topic.ballots))}
                            </strong>
                          ) : null}
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
                {pins.map((pin) => (
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
            </>
          )}
        </div>

        {/* The country itself, drawn at the full height of the spread. The
            outline prints even with nothing on it - an empty map is the
            honest picture of an empty ledger. */}
        <div className={styles.mapWrap}>
          <svg
            className={styles.map}
            viewBox={MAP_VIEWBOX}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={t.mapAria}
            onClick={pickNearest}
          >
            <path className={styles.outline} d={ISRAEL_MAP_PATH} />
            {pins.map((pin) => (
              <g
                key={pin.name}
                className={styles.pin}
                data-active={pin.name === active || undefined}
                transform={`translate(${pin.x} ${pin.y})`}
              >
                <title>{`${pin.name} · ${t.topicsUnit(pin.count)}`}</title>
                {/* An invisible disc over the pin, kept for the hover
                    tooltip the <title> above draws. It no longer decides
                    anything: overlapping discs are exactly what handed a tap
                    to the wrong town, and the selection is resolved from the
                    pointer's position on the map instead. */}
                <circle className={styles.pinHit} r={16} />
                <circle
                  className={styles.pinHalo}
                  r={pinRadius(pin.count) + 4}
                />
                <circle className={styles.pinCore} r={pinRadius(pin.count)} />
                {/* The count printed in the pin, when there is more than one
                    thing to count. */}
                {pin.count > 1 ? (
                  <text
                    aria-hidden
                    className={styles.pinCount}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {pin.count}
                  </text>
                ) : null}
                {/* The chosen town says its name on the map itself. */}
                {pin.name === active ? (
                  <text
                    aria-hidden
                    className={styles.pinLabel}
                    textAnchor="middle"
                    y={-(pinRadius(pin.count) + 7)}
                  >
                    {pin.name}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          <p className={styles.legend} aria-hidden>
            <span className={styles.legendDot} /> {t.legendPin}
          </p>
        </div>
      </div>
    </section>
  );
}
