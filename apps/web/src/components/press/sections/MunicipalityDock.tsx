'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { animate, utils } from 'animejs';
import { MUNICIPALITY_GEO, distanceKm } from '@sync/shared';
import {
  civicScorePercent,
  type LocalAuthorityKind,
  type MunicipalityCivicStats,
} from '@sync/shared/contracts';
import { Progress } from '@/components/uikit/progress';
import { municipalityHref } from '@/components/uikit/municipality-link';
import { sidewaysWheel } from './sidewaysWheel';
import { chime } from '@/lib/feedback/chime';
import type { Locale } from '@/lib/i18n';
import styles from './MunicipalityDock.module.css';

const NP_EASE = 'cubicBezier(0.2, 0, 0, 1)';

interface DockCopy {
  /** Announced name of the whole dock. */
  regionLabel: string;
  nowReading: string;
  openTopics: (n: number) => string;
  expandHint: string;
  collapseHint: string;
  dialLabel: string;
  /** Announced name of the tuner band in the bar. */
  tunerLabel: string;
  tuneTo: (name: string) => string;
  /**
   * What kind of authority a station is, for the one under the needle.
   *
   * A dial that prints only names implies every station is the same kind of
   * place, and they are not: a regional council administers settlements that
   * have no municipal standing of their own, so tuning from קריית טבעון to
   * its region is a change of altitude, not a change of town. Only the active
   * station says it - on every station it would be noise, since the reader is
   * spinning past those, not reading them.
   */
  kindLabel: Record<LocalAuthorityKind, string>;
  residents: string;
  platformUsers: string;
  openTopicsLabel: string;
  overall: string;
  engagement: string;
  cooperation: string;
  unmeasured: string;
  scaleNote: string;
  profileCta: string;
  ctaArrow: string;
}

const COPY: Record<Locale, DockCopy> = {
  he: {
    regionLabel: 'הרשות הנצפית',
    nowReading: 'נצפה עכשיו',
    openTopics: (n) => (n === 1 ? 'נושא אחד פתוח' : `${n} נושאים פתוחים`),
    expandHint: 'הקישו לפתיחה',
    collapseHint: 'הקישו לסגירה',
    dialLabel: 'כל הרשויות',
    tunerLabel: 'כוונון רשות',
    tuneTo: (name) => `כוונון אל ${name}`,
    kindLabel: {
      municipality: 'עירייה',
      local_council: 'מועצה מקומית',
      regional_council: 'מועצה אזורית',
      settlement: 'יישוב',
    },
    residents: 'תושבים',
    platformUsers: 'על הפלטפורמה',
    openTopicsLabel: 'נושאים פתוחים',
    overall: 'ציון כולל',
    engagement: 'מעורבות אזרחית',
    cooperation: 'שיתוף פעולה',
    unmeasured: 'טרם נמדד',
    scaleNote: '100- עד 100+',
    profileCta: 'לעמוד הרשות',
    ctaArrow: '←',
  },
  en: {
    regionLabel: 'The municipality in view',
    nowReading: 'Now reading',
    openTopics: (n) => (n === 1 ? '1 open topic' : `${n} open topics`),
    expandHint: 'Tap to open',
    collapseHint: 'Tap to close',
    dialLabel: 'All municipalities',
    tunerLabel: 'Tune the edition',
    tuneTo: (name) => `Tune to ${name}`,
    kindLabel: {
      municipality: 'Municipality',
      local_council: 'Local council',
      regional_council: 'Regional council',
      settlement: 'Settlement',
    },
    residents: 'Residents',
    platformUsers: 'On the platform',
    openTopicsLabel: 'Open topics',
    overall: 'Overall score',
    engagement: 'Civic engagement',
    cooperation: 'Cooperation',
    unmeasured: 'Not measured yet',
    scaleNote: '-100 to +100',
    profileCta: 'Municipality profile',
    ctaArrow: '→',
  },
};

/** Drag distance / flick speed past which the sheet commits to a state. */
const DRAG_COMMIT_PX = 44;
const FLICK_COMMIT_VELOCITY = 420;
/** Wheel travel over the dock that counts as asking for the panel. */
const WHEEL_COMMIT_PX = 34;
/** Quiet period after a wheel-driven change, so inertia cannot re-toggle it. */
const WHEEL_COOLDOWN_MS = 480;
/**
 * Upward page travel that folds an open sheet away.
 *
 * Accumulated rather than compared against a single frame: Lenis delivers
 * smooth scroll in small increments, and a per-event threshold this size is
 * never met by any one of them, so a slow pull back up would leave the panel
 * standing over the desk indefinitely.
 */
const PAGE_FOLD_PX = 24;
/** Sideways travel on the tuner before it is a tune rather than a page scroll. */
const TUNE_AXIS_PX = 6;
/**
 * The same, for a wheel: one push, one station.
 *
 * The dial is held to a longer cooldown than the river. A tile is a tile, but
 * a station is a whole edition - the readout re-points and the desk travels -
 * so overshooting it by three costs the reader more than overshooting a tile.
 */
const TUNE_WHEEL_STEP_PX = 55;
const TUNE_WHEEL_COOLDOWN_MS = 620;
const TUNE_WHEEL_QUIET_MS = 160;
/**
 * How long the desk has to hold still before the needle follows it.
 *
 * Travelling to another edition scrolls the carousel across every slide in
 * between, and Embla announces each one it passes. Following those literally
 * made the needle chase the desk through half a dozen municipalities and back
 * - the "jumping about" a one-station tune produced. The needle waits for the
 * desk to settle and then makes one move.
 */
const FOLLOW_SETTLE_MS = 220;

interface MunicipalityDockProps {
  /** The municipality at the head of the desk right now. */
  active: string;
  /** Desk municipalities in running order - they lead the dial. */
  deskOrder: string[];
  /**
   * Topics each municipality has on the desk right now. The stats row is the
   * better number - it counts every active vote, not only what this desk is
   * printing - but it is not always there, and a bar reading "0 open topics"
   * over a tile from that very city is worse than a slight undercount.
   */
  deskTopicCounts: Record<string, number>;
  /** Civic stats for every municipality the platform knows. */
  stats: MunicipalityCivicStats[];
  /** The reader's own authority, from their stored locality. Null if unset. */
  home: string | null;
  /** Travel the desk to a municipality picked on the dial. */
  onSelect: (municipality: string) => void;
  locale: Locale;
}

const formatCount = (value: number | null, locale: Locale, dash: string): string =>
  value === null ? dash : value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB');

/** A signed score prints its sign; an unmeasured one prints an em-dash. */
const formatScore = (score: number | null): string =>
  score === null ? '-' : `${score > 0 ? '+' : ''}${score}`;

const scoreBand = (score: number | null): 'up' | 'down' | 'flat' | 'none' => {
  if (score === null) return 'none';
  if (score > 12) return 'up';
  if (score < -12) return 'down';
  return 'flat';
};

/**
 * A figure that ticks from its previous value to its next one when the dial
 * lands on another municipality - the readout reads as one instrument being
 * re-pointed rather than four numbers being swapped out. Reduced motion, and
 * the server render, print the final number outright.
 */
function CivicFigure({ value, locale }: { value: number | null; locale: Locale }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(value);
  const reduceMotion = useReducedMotion();
  const dash = '-';
  const text = formatCount(value, locale, dash);

  useEffect(() => {
    const el = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!el || reduceMotion || value === null || from === null || from === value) {
      return;
    }

    const state = { n: from };
    const animation = animate(state, {
      n: value,
      duration: 520,
      ease: NP_EASE,
      modifier: utils.round(0),
      onUpdate: () => {
        el.textContent = formatCount(state.n, locale, dash);
      },
    });

    return () => {
      animation.cancel();
      el.textContent = formatCount(value, locale, dash);
    };
  }, [value, locale, reduceMotion]);

  return (
    <span ref={ref} className={styles.figure}>
      {text}
    </span>
  );
}

interface ScoreMeterProps {
  label: string;
  score: number | null;
  unmeasured: string;
  scaleNote: string;
}

/**
 * One signed score. The track runs the full -100..+100 range with its zero
 * printed as a standing tick, so a reader can see which side of nothing the
 * fill has reached instead of inferring it from a bare percentage.
 */
function ScoreMeter({ label, score, unmeasured, scaleNote }: ScoreMeterProps) {
  return (
    <div className={styles.meter} data-band={scoreBand(score)}>
      <span className={styles.meterLabel}>{label}</span>
      <b className={styles.meterValue}>{formatScore(score)}</b>
      <div className={styles.meterTrack}>
        <Progress
          className={styles.meterProgress}
          indicatorClassName={styles.meterFill}
          value={score === null ? 0 : civicScorePercent(score)}
          aria-label={label}
        />
        <span aria-hidden className={styles.meterZero} />
      </div>
      <span className={styles.meterNote}>{score === null ? unmeasured : scaleNote}</span>
    </div>
  );
}

/**
 * MunicipalityDock - the tuner at the foot of the desk.
 *
 * The desk is one continuous river of tiles from twenty different cities, so
 * a reader three swipes in needs a fixed place that answers "whose affairs am
 * I reading". That place is a radio dial: the editions are stations on a
 * band, the needle stands still in the middle, and the band slides under it -
 * as the desk drifts on its own, and under a thumb when the reader spins it.
 *
 * The tuner is the bar, always printed. Opening the dock adds the readout
 * above it - the city's size, its footprint here, its three civic scores -
 * which re-points as the needle moves. So the instrument is one thing at two
 * depths rather than a label that hides a different control.
 */
export function MunicipalityDock({
  active,
  deskOrder,
  deskTopicCounts,
  stats,
  home,
  onSelect,
  locale,
}: MunicipalityDockProps) {
  const t = COPY[locale];
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  /* The sheet's drag is started by hand rather than by framer's own listener.
     Left to itself, framer takes a pointer capture on the dock the moment a
     pointer goes down anywhere inside it - including on the band - and every
     subsequent move is then retargeted to the dock. The band's own listeners
     never fired, so the dial could not be spun at all.

     It is now only ever started on an OPEN sheet, to pull it shut. Opening is
     a tap and nothing else: a vertical pull anywhere on the shut bar used to
     raise the whole panel, which meant a reader tuning the dial with a thumb
     that wandered a few degrees off horizontal got the sheet over the desk
     instead of the next edition. The dial is the bar's job; the panel is the
     tap's. */
  const dragControls = useDragControls();

  const bandRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const byCode = useMemo(
    () => new Map(stats.map((entry) => [entry.municipality, entry])),
    [stats]
  );

  /* The desk sizes itself at one screen minus the chrome floating over it,
     and this bar is half of that chrome - so the bar has to say how tall it
     actually is. Its height is content-dependent (the municipality name sets
     the line, and Hebrew display type at a clamped size is not a number that
     survives being written down), so the --np-desk-dock-h token in tokens.css
     is only the bar's minimum height and the pre-hydration estimate. The
     measured truth is published as a SEPARATE property, `--np-desk-dock-
     measured`, which DeskCarousel's `.track` picks up by inheritance.

     Separate on purpose: the bar's own `min-block-size` reads
     `--np-desk-dock-h`, so publishing back into that name is a feedback loop
     - measured height becomes the minimum, which becomes the next measured
     height. It doubled the bar on the first pass.

     The measurement is the dock's own outer box - the bar plus the heavy rule
     it hangs off - because that whole box is what covers the tiles. It is
     taken only while the dock is shut: an open sheet is most of the viewport,
     and republishing that would crush the very tiles it is sitting over. The
     ResizeObserver watches the bar, which is the part whose height actually
     moves (the municipality name sets the line). */
  useEffect(() => {
    if (expanded) return;

    const bar = barRef.current;
    const dock = dockRef.current;
    const scope = dock?.closest('section');
    if (!bar || !dock || !scope) return;

    const publish = () => {
      scope.style.setProperty(
        '--np-desk-dock-measured',
        `${dock.getBoundingClientRect().height}px`
      );
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [expanded]);

  /* Desk municipalities lead, in the order the desk itself runs; everything
     else the platform knows follows, so the band is a way out of the current
     edition and not only a map of it. */
  const stations = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const name of [...deskOrder, ...stats.map((s) => s.municipality)]) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
    return ordered;
  }, [deskOrder, stats]);

  /* The band carries the desk's own editions - about thirty. Every authority
     the platform knows is 259 detents, which is not a dial, it is a phone
     book with a needle on it; those live in the panel's index instead.

     Their order is the reader's own geography, not the desk's running order.
     A dial that opens on רמלה for somebody in קריית טבעון is a dial about
     somebody else: the first thing under the needle has to be their own
     authority, then the regional council they sit inside, and only then the
     nearest place as the fallback for when neither is known. Everything after
     that is ordered by distance from home, so spinning outward on the dial is
     travelling outward on the map rather than down a heat ranking.

     With no stored locality there is no "here" to sort around, and the band
     keeps the desk's own order. */
  const bandStations = useMemo(() => {
    /* The station under the needle is NOT put at the head of this list.
       It was, to guarantee it had a place on the band at all - but with no
       stored locality to sort around, that made the band's order a function of
       where the needle stands: tuning one station along re-ranked the scale so
       that the station just left became second again, and the next push tuned
       straight back to it. The dial rocked between two editions and would go
       no further. The desk's own running order is the scale; the current
       edition only joins it if the desk somehow does not carry it. */
    const pool: string[] = [];
    const seen = new Set<string>();
    for (const name of [...(home ? [home] : []), ...deskOrder, active]) {
      if (!name || seen.has(name)) continue;
      seen.add(name);
      pool.push(name);
    }
    if (!home) return pool;

    const geoByName = new Map(MUNICIPALITY_GEO.map((m) => [m.name, m]));
    const homeGeo = geoByName.get(home);
    const km = (name: string): number => {
      const geo = geoByName.get(name);
      if (!homeGeo || !geo) return Number.POSITIVE_INFINITY;
      return distanceKm(homeGeo.lat, homeGeo.lng, geo.lat, geo.lng);
    };
    /* The regional council the reader sits inside: the nearest authority the
       platform classifies as one. `kind` is a typed enum on the stats row, so
       a station with no stats row simply has no kind and cannot win this
       tier - which is the honest outcome, since an authority the platform
       knows nothing about cannot be claimed as anybody's region. */
    const rest = pool.filter((name) => name !== home);
    const regional =
      rest
        .filter((name) => byCode.get(name)?.kind === 'regional_council')
        .sort((a, b) => km(a) - km(b))[0] ?? null;

    return [
      home,
      ...(regional ? [regional] : []),
      ...rest.filter((name) => name !== regional).sort((a, b) => km(a) - km(b)),
    ];
  }, [deskOrder, active, home, byCode]);

  const current = byCode.get(active) ?? null;
  const activeIndex = Math.max(0, bandStations.indexOf(active));

  /* A municipality with no stats row falls back to what the desk can see for
     itself. Not a coerced zero: the tiles are proof the topics exist. */
  const topicsOf = useCallback(
    (name: string): number =>
      byCode.get(name)?.openTopics ?? deskTopicCounts[name] ?? 0,
    [byCode, deskTopicCounts]
  );

  /* Only what is sourced gets printed.
     `municipalities.kind` ships with a `'municipality'` default, and
     20260811000003 classified exactly one tier against a named source: the 52
     regional councils named in the Population Authority's locality register.
     The rest still carry the default, and a good number of them are מועצה
     מקומית rather than עירייה - so stamping עירייה under them would be the
     dial publishing a column default as a fact about somebody's home town.
     A station with nothing under it is a station the platform cannot classify,
     which is the honest reading. When another tier gets a source, it joins the
     list here and nothing else has to change. */
  const kindOf = useCallback(
    (name: string): LocalAuthorityKind | null => {
      const kind = byCode.get(name)?.kind;
      return kind === 'regional_council' ? kind : null;
    },
    [byCode]
  );

  /* Every way a reader picks a station - band tap, index tap, spin release,
     wheel detent - lands here, always from inside the gesture's own handler,
     so the detent tick sounds here and nowhere else. The guard keeps it
     honest: a dial that has not moved does not click, and the needle's own
     follow-the-desk effect never comes through this path at all. */
  const select = useCallback(
    (name: string) => {
      if (name === active) return;
      chime('tick');
      onSelect(name);
    },
    [active, onSelect]
  );

  // ---- The band ----------------------------------------------------------
  /* The band is transformed, not scrolled.
     A scroll container would have to be driven through `scrollLeft`, whose
     sign in RTL the engines disagree about - the previous dial worked around
     that with a measured relative `scrollBy`. A transform sidesteps the whole
     question: every position here is a layout offset (`offsetLeft`), which is
     direction-agnostic, and the needle is what stands still. */
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  /* Where the reader just tuned to, until the desk gets there.
     Selecting only asks the carousel to travel, and it takes a moment. In
     that moment `active` is still the old municipality, and the effect below
     would re-centre the band on it - the needle sprang back to where it had
     been every single time somebody spun it. */
  const pendingRef = useRef<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyOffset = useCallback((x: number, animated: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    offsetRef.current = x;
    track.style.transition = animated ? 'transform 420ms var(--np-ease)' : 'none';
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  }, []);

  /** Where the band has to sit for this station to be under the needle.
   *
   *  Measured from painted rectangles rather than from `offsetLeft`. The band
   *  is an RTL flex row that overflows its own box in both directions, and
   *  layout offsets there are not the simple left-to-right ladder the
   *  arithmetic assumed - a spin of one station computed as a spin of none,
   *  so every tune snapped straight back to where it started. A rect is what
   *  the reader can actually see, in one coordinate system, whichever way the
   *  page runs. */
  const offsetFor = useCallback((name: string): number | null => {
    const band = bandRef.current;
    const track = trackRef.current;
    if (!band || !track) return null;
    const item = track.querySelector<HTMLElement>(
      `[data-station="${CSS.escape(name)}"]`
    );
    if (!item) return null;
    const bandBox = band.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const delta =
      bandBox.left + bandBox.width / 2 - (itemBox.left + itemBox.width / 2);
    /* Measured against what is on screen this instant, not against the last
       value we set: a glide already in flight would otherwise have its
       remaining travel counted twice. */
    const painted = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    return painted + delta;
  }, []);

  /* The needle answers to the dial and to nothing else - see the note on
     `activeIndex` in ConsensusDeskClient. It re-centres whenever the edition
     changes, except while the reader has hold of the band themselves. */
  useEffect(() => {
    if (draggingRef.current) return;

    if (pendingRef.current) {
      /* Hold the needle where the reader put it until the desk actually gets
         there. `active` runs through every edition the carousel scrolls past
         on the way, so releasing on the first change let the needle follow
         the journey instead of waiting for the destination. The backstop
         timer below covers the case where it never arrives at all. */
      if (pendingRef.current !== active) return;
      pendingRef.current = null;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    }

    /* One move per settling, not one per slide announced. */
    const settle = setTimeout(() => {
      const target = offsetFor(active);
      if (target !== null) applyOffset(target, !reduceMotion);
    }, FOLLOW_SETTLE_MS);
    return () => clearTimeout(settle);
  }, [active, expanded, bandStations.length, offsetFor, applyOffset, reduceMotion]);

  useEffect(() => {
    const onResize = () => {
      if (draggingRef.current) return;
      const target = offsetFor(active);
      if (target !== null) applyOffset(target, false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, offsetFor, applyOffset]);

  /** The station under the needle right now, by what is painted. */
  const stationAtNeedle = useCallback((): string | null => {
    const band = bandRef.current;
    const track = trackRef.current;
    if (!band || !track) return null;
    const bandBox = band.getBoundingClientRect();
    const needle = bandBox.left + bandBox.width / 2;
    let nearest: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const item of track.querySelectorAll<HTMLElement>('[data-station]')) {
      const box = item.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - needle);
      if (distance < best) {
        best = distance;
        nearest = item.dataset.station ?? null;
      }
    }
    return nearest;
  }, []);

  /* Everything the spin handlers need, behind one ref.
     They have to be registered exactly once: `select` changes identity every
     time the desk drifts to another municipality, and an effect that re-runs
     mid-gesture tears its own listeners down and takes the gesture's local
     state - which pointer, where it started - with them. The spin registered,
     then silently stopped tracking the first time the river moved under it. */
  const live = useRef({
    applyOffset,
    offsetFor,
    stationAtNeedle,
    select,
    dragControls,
    reduceMotion,
    stations: bandStations,
    active,
  });
  live.current = {
    applyOffset,
    offsetFor,
    stationAtNeedle,
    select,
    dragControls,
    reduceMotion,
    stations: bandStations,
    active,
  };

  /* Spinning the band. The axis is still decided before the pointer is taken,
     but only one axis belongs to the dial now: sideways is a tune, and a
     vertical pull is let go entirely so the page scrolls under it. */
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let axis: 'none' | 'tune' | 'sheet' = 'none';
    /* How far the band may travel before the first or the last station would
       leave the needle behind. A real tuner stops at the ends of its scale
       rather than spinning off into blank air. */
    let limit: { lo: number; hi: number } | null = null;

    const down = (evt: PointerEvent) => {
      if (evt.pointerType === 'mouse' && evt.button !== 0) return;
      pointerId = evt.pointerId;
      startX = evt.clientX;
      startY = evt.clientY;
      startOffset = offsetRef.current;
      axis = 'none';

      const { offsetFor: to, stations: names } = live.current;
      const first = names.length ? to(names[0]) : null;
      const last = names.length ? to(names[names.length - 1]) : null;
      limit =
        first !== null && last !== null
          ? { lo: Math.min(first, last), hi: Math.max(first, last) }
          : null;
    };

    const move = (evt: PointerEvent) => {
      if (pointerId !== evt.pointerId) return;
      const dx = evt.clientX - startX;
      const dy = evt.clientY - startY;

      if (axis === 'none') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < TUNE_AXIS_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'tune' : 'sheet';
        if (axis === 'tune') {
          draggingRef.current = true;
          try {
            band.setPointerCapture(evt.pointerId);
          } catch {
            /* Capture is a convenience; the spin tracks without it. */
          }
        } else {
          /* Vertical from the band is not the dock's gesture at all. It used
             to raise the sheet; now it is abandoned, which leaves the page to
             scroll normally under the reader's thumb. */
          pointerId = null;
          return;
        }
      }
      if (axis !== 'tune') return;

      const wanted = startOffset + dx;
      const bounded = limit
        ? Math.min(limit.hi, Math.max(limit.lo, wanted))
        : wanted;
      live.current.applyOffset(bounded, false);
    };

    const up = (evt: PointerEvent) => {
      if (pointerId !== evt.pointerId) return;
      const tuned = axis === 'tune';
      pointerId = null;
      axis = 'none';
      if (!tuned) return;

      const { stationAtNeedle: at, offsetFor: to, applyOffset: put, select: pick, reduceMotion: still } = live.current;
      const landed = at();
      draggingRef.current = false;
      if (landed) {
        /* Held until the desk arrives - or for a beat and a half, in case it
           cannot: a municipality the carousel has no tile for would otherwise
           park the needle away from the edition actually on screen. */
        pendingRef.current = landed;
        if (pendingTimer.current) clearTimeout(pendingTimer.current);
        pendingTimer.current = setTimeout(() => {
          pendingRef.current = null;
          /* The desk never moved at all - a station with no tile on this desk
             can be asked for and never arrived at. - it is a
             The needle goes back to reporting what is actually on screen,
             because a tuner pointing at something the reader cannot see is
             worse than one that admits the desk stayed put. */
          const now = live.current;
          const back = now.offsetFor(now.active);
          if (back !== null) now.applyOffset(back, !now.reduceMotion);
        }, 1500);
        // Snap first, then tell the desk: the needle must not wait on a
        // carousel that takes a moment to travel.
        const target = to(landed);
        if (target !== null) put(target, !still);
        pick(landed);
      }
    };

    /* Moves are watched on the window, not on the band: whichever element
       ends up holding the pointer capture, the event still reaches here. */
    band.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      band.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // Registered once, for the life of the dock - see the note on `live`.
  }, []);

  /* Spinning the band with a wheel.
   *
   * The same gesture a thumb makes on the dial, for the reader who has a
   * trackpad instead: sideways over the BAND tunes, sideways anywhere else
   * over the desk moves the tiles. Which is the whole distinction - the
   * toolbar is re-pointed by pushing the toolbar, and by nothing else.
   *
   * Non-passive and stopped rather than merely defaulted: the page's smooth
   * scroll reads the wheel on an ancestor and does not consult
   * `defaultPrevented`. */
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;

    const wheel = sidewaysWheel({
      stepPx: TUNE_WHEEL_STEP_PX,
      cooldownMs: TUNE_WHEEL_COOLDOWN_MS,
      quietMs: TUNE_WHEEL_QUIET_MS,
      onStep: (forward) => {
        const { stations: names, active: current, select: pick } = live.current;
        const at = names.indexOf(current);
        const next = Math.min(
          Math.max((at < 0 ? 0 : at) + (forward ? 1 : -1), 0),
          names.length - 1
        );
        const name = names[next];
        if (name) pick(name);
      },
    });

    band.addEventListener('wheel', wheel, { passive: false });
    return () => band.removeEventListener('wheel', wheel);
    // Registered once - everything it reads comes off `live`.
  }, []);

  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    },
    []
  );

  // ---- Scrolling out of the panel ---------------------------------------
  /* Scrolling up from the top of the readout folds the sheet back down. The
     wheel is otherwise let through, so the sheet's own overflow still scrolls
     normally once it is open and past its top.
     Scrolling DOWN no longer opens it. Reading the desk is a downward gesture
     and so was asking for the panel, so the dock kept rising over the tiles a
     reader was in the middle of - the panel is a tap now, and the wheel only
     ever puts it away. */
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    let travel = 0;
    let until = 0;

    const wheel = (evt: WheelEvent) => {
      const now = evt.timeStamp;
      if (now < until) {
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }

      const panel = panelRef.current;
      const closing =
        expanded && evt.deltaY < 0 && (panel ? panel.scrollTop <= 0 : true);
      if (!closing) {
        travel = 0;
        return;
      }

      /* The page must not scroll past the desk while the dock is answering.
         Lenis owns the page's scroll from a window listener, so the event has
         to be stopped on its way up as well as defaulted - preventDefault
         alone leaves the smooth scroller free to carry the page anyway. */
      evt.preventDefault();
      evt.stopPropagation();
      travel += evt.deltaY;
      if (Math.abs(travel) < WHEEL_COMMIT_PX) return;
      travel = 0;
      until = now + WHEEL_COOLDOWN_MS;
      setExpanded(false);
    };

    dock.addEventListener('wheel', wheel, { passive: false });
    return () => dock.removeEventListener('wheel', wheel);
  }, [expanded]);

  /* Reading back up the page folds the sheet away with it.
     The wheel handler above only sees gestures that land on the dock itself;
     a reader who opens the panel and then scrolls back up over the desk was
     leaving it standing there, covering the tiles they had gone back for. The
     panel closes on its own spring, so this reads as the sheet following the
     page rather than being dismissed. */
  useEffect(() => {
    if (!expanded) return;

    let last = window.scrollY;
    let climbed = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      /* Any downward travel resets it: the fold is for going back, not for
         the jitter at the end of a flick down. */
      climbed = delta < 0 ? climbed - delta : 0;
      if (climbed >= PAGE_FOLD_PX) setExpanded(false);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [expanded]);

  /* Only ever a way out. The drag is started on an open sheet alone, so an
     upward flick has nothing left to open and is ignored rather than treated
     as a request for a panel that is already up. */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const flickedDown =
      info.offset.y > DRAG_COMMIT_PX || info.velocity.y > FLICK_COMMIT_VELOCITY;
    if (flickedDown) setExpanded(false);
  };

  const panelId = 'municipality-dock-panel';
  /* Stations far off the band are painted but not reachable by tab: they are
     off the visible strip, and a focus ring on something nobody can see is
     worse than no focus stop at all. The full list inside the panel is the
     way to every edition without spinning. */
  const inReach = (index: number) => Math.abs(index - activeIndex) <= 4;

  return (
    <motion.div
      ref={dockRef}
      className={styles.dock}
      data-expanded={expanded || undefined}
      /* The readout's oversized ghost name travels with the needle. */
      style={
        {
          '--tuner-progress':
            bandStations.length > 1 ? activeIndex / (bandStations.length - 1) : 0,
        } as React.CSSProperties
      }
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.24, bottom: expanded ? 0.24 : 0.04 }}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      role="region"
      aria-label={t.regionLabel}
    >
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            key="panel"
            className={styles.panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 320, damping: 38, mass: 0.9 }
            }
          >
            <div className={styles.panelInner} ref={panelRef}>
              <div className={styles.readout}>
                <span aria-hidden className={styles.readoutGhost}>
                  {active}
                </span>

                <div className={styles.readoutHead}>
                  <h3 className={styles.readoutName}>{active}</h3>
                  <a className={styles.profileCta} href={municipalityHref(active, locale)}>
                    {t.profileCta}
                    <span aria-hidden>{t.ctaArrow}</span>
                  </a>
                </div>

                <dl className={styles.counts}>
                  <div className={styles.count}>
                    <dt>{t.residents}</dt>
                    <dd>
                      <CivicFigure value={current?.residents ?? null} locale={locale} />
                    </dd>
                  </div>
                  <div className={styles.count}>
                    <dt>{t.platformUsers}</dt>
                    <dd>
                      <CivicFigure value={current?.platformUsers ?? 0} locale={locale} />
                    </dd>
                  </div>
                  <div className={styles.count}>
                    <dt>{t.openTopicsLabel}</dt>
                    <dd>
                      <CivicFigure value={topicsOf(active)} locale={locale} />
                    </dd>
                  </div>
                </dl>

                <div className={styles.meters}>
                  <ScoreMeter
                    label={t.overall}
                    score={current?.overallScore ?? null}
                    unmeasured={t.unmeasured}
                    scaleNote={t.scaleNote}
                  />
                  <ScoreMeter
                    label={t.engagement}
                    score={current?.engagementScore ?? null}
                    unmeasured={t.unmeasured}
                    scaleNote={t.scaleNote}
                  />
                  <ScoreMeter
                    label={t.cooperation}
                    score={current?.cooperationScore ?? null}
                    unmeasured={t.unmeasured}
                    scaleNote={t.scaleNote}
                  />
                </div>
              </div>

              {/* Every edition as a plain list. The band is how you travel;
                  this is how you find somewhere that is not next door. */}
              <div className={styles.index} role="group" aria-label={t.dialLabel}>
                {stations.map((name) => {
                  const entry = byCode.get(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      className={styles.indexItem}
                      aria-current={name === active ? 'true' : undefined}
                      onClick={() => select(name)}
                    >
                      <span className={styles.indexName}>{name}</span>
                      <span
                        className={styles.indexScore}
                        data-band={scoreBand(entry?.overallScore ?? null)}
                      >
                        {formatScore(entry?.overallScore ?? null)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={styles.bar}
        ref={barRef}
        /* Only an OPEN sheet is draggable, and only from outside the band:
           the drag is the way to pull it shut. While the dock is shut a
           vertical pull here is nobody's gesture, so it falls through to the
           page - which is what a reader dragging past the desk expects. */
        onPointerDown={(event) => {
          if (!expanded) return;
          if (bandRef.current?.contains(event.target as Node)) return;
          dragControls.start(event);
        }}
        /* The whole bar is the tap target, not just the chevron - the readout
           and the "now reading" kicker are the parts a thumb actually goes
           for. Taps that started on the dial are the dial's: a station tunes
           to itself, and the band's own click must not also raise the sheet. */
        onClick={(event) => {
          if (bandRef.current?.contains(event.target as Node)) return;
          setExpanded((open) => !open);
        }}
      >
        <button
          type="button"
          className={styles.toggle}
          /* The bar around it toggles too, so this stops here rather than
             bubbling into it and undoing itself. The button stays for the
             keyboard and for aria-expanded; the bar is the thumb's target. */
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((open) => !open);
          }}
          aria-expanded={expanded}
          aria-controls={expanded ? panelId : undefined}
        >
          <span aria-hidden className={styles.grip} />
          <span className={styles.barKicker}>{t.nowReading}</span>
          <span className={styles.barHint}>
            {expanded ? t.collapseHint : t.expandHint}
            <span aria-hidden className={styles.barChevron}>
              ▲
            </span>
          </span>
        </button>

        {/* ---- The tuner. Names slide above; the needle marks the scale
                below them, and never crosses the word it is pointing at. ---- */}
        <div className={styles.tuner}>
          <div
            ref={bandRef}
            className={styles.band}
            role="group"
            aria-label={t.tunerLabel}
          >
            <div ref={trackRef} className={styles.track}>
              {bandStations.map((name, index) => {
                const kind = kindOf(name);
                return (
                <button
                  key={name}
                  type="button"
                  data-station={name}
                  className={styles.station}
                  aria-current={name === active ? 'true' : undefined}
                  aria-label={t.tuneTo(name)}
                  tabIndex={inReach(index) ? undefined : -1}
                  /* A scroll container brought a focused item into view for
                     free; a transformed one has to be told. Without this,
                     tabbing put the focus ring outside the band. */
                  onFocus={() => {
                    const target = offsetFor(name);
                    if (target !== null) applyOffset(target, !reduceMotion);
                  }}
                  onClick={() => select(name)}
                >
                  <span className={styles.stationName}>{name}</span>
                  <span className={styles.stationTopics}>
                    {kind ? (
                      <>
                        <span className={styles.stationKind}>{t.kindLabel[kind]}</span>
                        <span aria-hidden className={styles.stationDot}>
                          ·
                        </span>
                      </>
                    ) : null}
                    {t.openTopics(topicsOf(name))}
                  </span>
                </button>
                );
              })}
            </div>
          </div>

          <div className={styles.rail} aria-hidden>
            <span className={styles.scale} />
            <span className={styles.needle} />
          </div>
        </div>

      </div>
    </motion.div>
  );
}
