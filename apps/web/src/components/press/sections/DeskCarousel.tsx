'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { DeskDrift, type DeskDriftType } from './deskDrift';
import { DeskDragLockContext, type DeskDragLock } from './deskDragLock';
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
}

/** Drift speed with nobody reading, and the pace it eases to under a cursor. */
const DRIFT_SPEED = 0.6;
const HOVER_SPEED = 0.12;

/**
 * How long the desk holds still after the dial steers it somewhere.
 *
 * Long enough to read the edition the reader asked for; short enough that a
 * desk left alone goes back to being a river.
 */
const TRAVEL_LINGER_MS = 7000;

/**
 * Sideways travel on a wheel or trackpad before the desk moves a tile, and how
 * long the desk holds still afterwards.
 *
 * A two-finger sideways swipe is how a laptop reads a river, and Embla only
 * listens for drags - so the desk sat there under it. The travel is
 * accumulated rather than answered per event because one flick of a trackpad
 * arrives as thirty events of four pixels each. Kept short: a desk that waits
 * for a hard push before it moves at all is a desk the reader concludes is
 * broken, and every tile is one gentle swipe from the next.
 */
const WHEEL_STEP_PX = 40;
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
    if (!emblaApi || !viewport) return;

    let travel = 0;
    const onWheel = (event: WheelEvent) => {
      /* Shift+wheel is how a mouse with one wheel says sideways, and the
         browser reports it on whichever axis it likes - Chrome moves it to
         deltaX, Firefox leaves it on deltaY. Take the larger of the two and
         read it as horizontal either way. */
      const bigger =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      const sideways = event.shiftKey ? bigger : event.deltaX;
      // Anything else on the vertical is the page's; only a gesture genuinely
      // working across the screen is taken.
      if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      if (!sideways) return;
      event.preventDefault();
      /* And kept from the page's own smooth scroll, which reads the wheel on
         an ancestor and does not care whether the default was prevented -
         without this a shift+wheel steers the desk and scrolls the page. */
      event.stopPropagation();
      travel += sideways;
      if (Math.abs(travel) < WHEEL_STEP_PX) return;
      drift?.linger(WHEEL_LINGER_MS);
      /* The track is RTL, so a swipe that pushes content to the right - a
         negative deltaX - is a move towards the next tile in reading order. */
      if (travel < 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
      travel = 0;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [emblaApi, drift]);

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
