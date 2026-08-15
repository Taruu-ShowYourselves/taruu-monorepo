'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { DeskDrift, type DeskDriftType } from './deskDrift';
import { sidewaysWheel } from './sidewaysWheel';
import { DeskDragLockContext, type DeskDragLock } from './deskDragLock';
import { useDeskPanelActive } from './deskPanelActive';
import type { Locale } from '@/lib/i18n';
import styles from './DeskCarousel.module.css';

/** Handle for controls that live outside the track (the municipality dial). */
export interface DeskCarouselControls {
  scrollTo: (index: number) => void;
}

interface DeskCarouselProps {
  children: React.ReactNode;
  /** Announced label for the carousel region. */
  label: string;
  /** Kept for callers; the track itself no longer prints any copy. */
  locale?: Locale;
  /** Index of the slide at the head of the viewport, whenever it changes. */
  onActiveIndexChange?: (index: number) => void;
  /** Filled once Embla is up so outside controls can steer the track. */
  controlsRef?: React.MutableRefObject<DeskCarouselControls | null>;
  /**
   * Scenery, not an instrument. The intro's backdrop desk is behind copy at
   * opacity 0 for most of its life; a drift engine, a wheel listener and
   * hover handlers on it are pure idle cost - and an invisible track that
   * moves on its own burns GPU re-rasterising a blurred layer nobody sees.
   * Decorative renders the same mosaic, still.
   */
  decorative?: boolean;
}

/**
 * Drift speed with nobody reading, and the pace it eases to under a cursor.
 *
 * Pixels per engine tick - Embla steps its animation at a fixed 60Hz with an
 * accumulator, so this is device-independent: 0.32 is ~19px/s on every
 * display. It was 0.6 (~36px/s), which read as the desk hurrying its own
 * readers; the tiles are for reading, and the river only needs to prove it
 * flows.
 */
const DRIFT_SPEED = 0.32;
const HOVER_SPEED = 0.08;

/**
 * How long the desk holds still after the dial steers it somewhere.
 *
 * Long enough to read the edition the reader asked for; short enough that a
 * desk left alone goes back to being a river.
 */
const TRAVEL_LINGER_MS = 7000;

/**
 * One sideways push, one tile. See sidewaysWheel.ts for how a flick is read.
 *
 * The cooldown outlasts the momentum a trackpad keeps sending after the
 * fingers have left it, so a flick cannot spend itself as six tiles; the quiet
 * period is short enough that pushing again straight away still travels.
 */
const WHEEL_STEP_PX = 55;
const WHEEL_COOLDOWN_MS = 420;
const WHEEL_QUIET_MS = 160;
const WHEEL_LINGER_MS = 2500;

const EMBLA_OPTIONS = {
  direction: 'rtl' as const,
  align: 'start' as const,
  loop: true,
  skipSnaps: true,
};

/**
 * DeskCarousel - RTL swipe carousel for topic cards (Embla under the hood:
 * drag momentum, snap, native RTL). Sways continuously; a cursor on the desk
 * eases the sway down to a reading pace rather than halting it, so the tiles
 * never look frozen. Off entirely under prefers-reduced-motion.
 *
 * The carousel runs at every width. It used to stand down below 800px and let
 * the track set as a static vertical bento, which put the two heaviest desks
 * between a phone reader and the rest of the page: eight full-measure tiles of
 * document scroll before the footer. The track drops to a single row of
 * phone-width tiles there instead (see the module CSS) and the sway carries
 * them past, so the desks cost one screen each and stay swipeable.
 */
export function DeskCarousel({
  children,
  label,
  onActiveIndexChange,
  controlsRef,
  decorative = false,
}: DeskCarouselProps) {
  /* The track's drag, lent to whichever tile is being pushed. Embla calls
     `watchDrag` on every pointer down and skips the drag when it returns
     false, so a tile holding the lock stops the desk sliding under the
     gesture - without a reInit, which would snap the drift to a slide. Both
     the flag and the handle are refs: the carousel must not re-render, let
     alone re-initialise, in the middle of somebody's ballot. */
  const locked = useRef(false);
  /* The drift is stopped with the drag, not merely slowed: a tile that keeps
     sliding while it is being pushed is a tile that does not feel held. */
  const driftRef = useRef<DeskDriftType | null>(null);
  const dragLock = useMemo<DeskDragLock>(
    () => ({
      locked,
      lock: () => {
        locked.current = true;
        driftRef.current?.hold();
      },
      release: () => {
        locked.current = false;
        driftRef.current?.release();
      },
    }),
    []
  );
  const options = useMemo(
    () => ({ ...EMBLA_OPTIONS, watchDrag: () => !locked.current }),
    []
  );
  // Computed once - plugin config doesn't affect SSR markup, so the
  // server/client difference is hydration-safe.
  /* One instance for the life of the carousel: re-initialising Embla to change
     pace snaps the track to its nearest slide, which reads as the desk jumping
     backwards the moment a cursor arrives. `DeskDrift` takes its new speed
     live instead. */
  const [drift] = useState<DeskDriftType | null>(() => {
    if (decorative) return null;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return null;
    }
    return DeskDrift({ speed: DRIFT_SPEED, startDelay: 800 });
  });
  const plugins = useMemo(() => (drift ? [drift] : []), [drift]);
  driftRef.current = drift;

  const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);

  /* Inside the tabbed desk, the hidden edition keeps its layout but must not
     keep its river running: an invisible track translating every frame is
     idle main-thread and GPU work. hold() is the exact-stop primitive; the
     release only fires for a panel that was actually stood down, so the
     initial active render never touches a drift that is still on its own
     start delay. */
  const panelActive = useDeskPanelActive();
  const stoodDown = useRef(false);
  useEffect(() => {
    if (!drift || !emblaApi) return;
    if (!panelActive) {
      drift.hold();
      stoodDown.current = true;
    } else if (stoodDown.current) {
      stoodDown.current = false;
      drift.release();
    }
  }, [panelActive, drift, emblaApi]);

  /* The desk reports where it is; it no longer offers to be paged. The arrows
     were furniture for a river that already moves on its own, and every one of
     them was a second way to do what a drag and the municipality tuner
     already do. */
  const refresh = useCallback(() => {
    if (!emblaApi) return;
    onActiveIndexChange?.(emblaApi.selectedScrollSnap());
  }, [emblaApi, onActiveIndexChange]);

  useEffect(() => {
    if (!emblaApi) return;
    refresh();
    emblaApi.on('select', refresh);
    emblaApi.on('reInit', refresh);
    return () => {
      emblaApi.off('select', refresh);
      emblaApi.off('reInit', refresh);
    };
  }, [emblaApi, refresh]);

  /* A sideways wheel steers the river.
   *
   * Non-passive on purpose: the sideways delta has to be swallowed, or the
   * browser answers it with its own horizontal pan - and on macOS, at the end
   * of the page, with the back-navigation gesture. The page's vertical scroll
   * is left entirely alone; only a gesture that is genuinely working across
   * the screen is taken, on the same axis test the pager uses. */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  /* Embla hands out a callback ref and the wheel listener needs the same node,
     so the element is kept as it passes through. */
  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      emblaRef(node);
    },
    [emblaRef]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!emblaApi || !viewport || decorative) return;

    const onWheel = sidewaysWheel({
      stepPx: WHEEL_STEP_PX,
      cooldownMs: WHEEL_COOLDOWN_MS,
      quietMs: WHEEL_QUIET_MS,
      onStep: (forward) => {
        drift?.linger(WHEEL_LINGER_MS);
        /* One tile from where the desk IS, not from the slide it last
           announced.
           `scrollNext` steps from the selected snap, and this desk is never
           parked on one: it drifts continuously, so by the time a reader
           pushes, the selection can be most of the river behind the tiles in
           front of them - and the step then travelled all of that distance in
           one go. A single push threw the desk twenty columns.
           So the snap nearest what is painted right now is found first, and
           the step is taken from there. Distances are compared the short way
           round the loop, since the track is a ring. */
        const snaps = emblaApi.scrollSnapList();
        if (!snaps.length) return;
        const now = emblaApi.scrollProgress();
        let nearest = 0;
        let best = Number.POSITIVE_INFINITY;
        snaps.forEach((snap, index) => {
          const gap = Math.abs(snap - now);
          const shortest = Math.min(gap, 1 - gap);
          if (shortest < best) {
            best = shortest;
            nearest = index;
          }
        });

        /* The bento stacks three tiles to a column, and Embla holds a snap per
           TILE - so three of them stand at the same place on the track. The
           next snap along is usually the tile below the current one, at the
           identical offset, and stepping to it moves the desk by nothing at
           all. Walk on until the offset actually changes: one push is one
           column of the mosaic, whatever it happens to be carrying. */
        const here = snaps[nearest];
        const dir = forward ? 1 : -1;
        const wrap = (index: number) =>
          ((index % snaps.length) + snaps.length) % snaps.length;
        for (let step = 1; step <= snaps.length; step += 1) {
          const probe = wrap(nearest + dir * step);
          if (Math.abs(snaps[probe] - here) > 1e-4) {
            emblaApi.scrollTo(probe);
            return;
          }
        }
      },
    });

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [emblaApi, drift, decorative]);

  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = emblaApi
      ? {
          scrollTo: (index: number) => {
            drift?.linger(TRAVEL_LINGER_MS);
            emblaApi.scrollTo(index);
          },
        }
      : null;
    return () => {
      controlsRef.current = null;
    };
  }, [emblaApi, controlsRef, drift]);

  return (
    <div className={styles.carousel} role="region" aria-label={label}>
      <div
        className={styles.viewport}
        ref={setViewport}
        onMouseEnter={() => drift?.setSpeed(HOVER_SPEED)}
        onMouseLeave={() => drift?.setSpeed(DRIFT_SPEED)}
      >
        <DeskDragLockContext.Provider value={dragLock}>
          <ol className={styles.track}>{children}</ol>
        </DeskDragLockContext.Provider>
      </div>
    </div>
  );
}
