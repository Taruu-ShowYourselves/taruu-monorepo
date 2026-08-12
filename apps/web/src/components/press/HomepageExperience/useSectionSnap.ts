'use client';

import { useEffect, type RefObject } from 'react';
import { useLenis } from '@/providers/LenisProvider';
import {
  SNAP_STOPS_EVENT,
  readNoRestRanges,
  readPublishedStops,
} from './snapStops';

/**
 * Turns the homepage's free scroll into a swipe: one gesture moves one screen,
 * and the page always comes to rest on a section's own edge.
 *
 * The page is a sequence of full-screen desks, and free inertial scrolling
 * treated it as one long column - a flick from the municipal desk could land
 * three sections down, halfway into an argument, with a headline cut by the
 * top of the screen. Lenis is what carries the momentum, so the snap has to
 * be built on Lenis rather than on CSS scroll-snap: the browser never sees a
 * native scroll gesture to snap after.
 *
 * Two rules do the work. The reader is only ever moved to a NEIGHBOURING stop,
 * so however hard the flick, the next thing on the screen is the next thing on
 * the page. And a section taller than the screen gets a second stop at its
 * foot, so its lower half stays reachable instead of being snapped away from.
 */

/** How long the scroll has to be quiet before it counts as a gesture ending. */
const SETTLE_MS = 130;
const SNAP_DURATION = 0.55;
const SNAP_DURATION_MAX = 1.1;
/**
 * Travel from the gesture's start that commits it to a page: better than a
 * quarter of the screen, never less than 140px.
 *
 * A swipe clears this without trying - inertia alone carries further than a
 * quarter screen. A reader nudging the page a few lines to finish a paragraph
 * or look at a card does not, and is left alone: below this the page is theirs
 * to move freely, and nothing snaps.
 */
const GESTURE_SHARE = 0.28;
const GESTURE_MIN_PX = 140;
/**
 * How far a gesture's horizontal travel must exceed its vertical before it is
 * read as sideways. Above 1 so a diagonal still counts as a page turn - only
 * a gesture genuinely working across the screen is exempt.
 */
const AXIS_DOMINANCE = 1.15;
/** Quiet time after which the next input starts a fresh gesture. */
const AXIS_RESET_MS = 220;
/** Two stops closer than this are the same stop; this close is "resting". */
const REST_EPSILON = 6;
/**
 * How much taller than the screen a section must be to earn a foot stop, in
 * pixels. Any real overrun deserves a way to reach the bottom of it; below
 * this the foot and the edge are the same picture and the stop is a swipe
 * spent on nothing.
 */
const FOOT_STOP_MIN = 48;
/**
 * No single swipe may cross more than this many screens. Held at 1.25 it split
 * the ordinary run-out between a desk and the next runway - a gap barely over
 * one screen - into two rests, the first of them halfway down a section the
 * reader had already read.
 */
const MAX_STEP_SCREENS = 1.5;
/**
 * A jump larger than this is not a swipe - a hash link, a dragged scrollbar, a
 * restored scroll position. Those land on the nearest stop rather than being
 * dragged back to a neighbour of wherever the reader was.
 */
const LONG_JUMP_SCREENS = 1.6;

interface SectionSnapOptions {
  /** Snapping is motion; readers who asked for less keep plain scrolling. */
  enabled: boolean;
}

export function useSectionSnap(
  rootRef: RefObject<HTMLElement | null>,
  { enabled }: SectionSnapOptions
): void {
  const lenis = useLenis();

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !lenis || !root) return;

    let stops: number[] = [];
    /** Where the current gesture began - null between gestures. */
    let origin: number | null = null;
    let originY = 0;
    let settleTimer = 0;
    let animating = false;

    // Sections carry live data and lazily-sized media, so the stop list is
    // remeasured whenever the page changes height rather than once on mount.
    const observer = new ResizeObserver(() => measure());

    /** Scaled to the screen: a tenth of a phone is not a tenth of a desktop. */
    const gestureThreshold = () =>
      Math.max(GESTURE_MIN_PX, window.innerHeight * GESTURE_SHARE);

    const nearest = (y: number): number => {
      let best = 0;
      for (let i = 1; i < stops.length; i += 1) {
        if (Math.abs(stops[i] - y) < Math.abs(stops[best] - y)) best = i;
      }
      return best;
    };

    const measure = () => {
      // The dock pins to the top, so a section's edge has to stop below it or
      // the first line of every desk lands underneath the nav.
      /* A section rests with its own top at the top of the screen, not a
         dock's height above it: sections reserve the pinned nav as padding
         (see HomepageExperience's `main > section` rule), so their content
         already starts below it. Subtracting the dock here as well shifted
         every section down by its height and pushed the same amount off the
         bottom - which is always the last thing in the section.
         The dock is still watched, because its height is what the sections
         reserve, and it changes when the fonts land and the row re-lays. */
      const dock = root.querySelector<HTMLElement>('[data-nav-dock]');
      if (dock) observer.observe(dock);
      const viewport = window.innerHeight;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - viewport
      );
      const sections = Array.from(
        root.querySelectorAll<HTMLElement>('[data-site-layer] main > section')
      );

      // A scrubbed section says where its own stops are; see snapStops.ts.
      // Where it does, its word is final: every position it did not name is a
      // frame of a transition, and resting there shows the reader a beat
      // half-arrived or a plate mid-fade.
      const scrubbed = readNoRestRanges(root);
      const insideScrubbed = (y: number) =>
        scrubbed.some((range) => y >= range.start && y < range.end);

      const raw: number[] = [0, ...readPublishedStops(root)];
      for (const section of sections) {
        const top = section.getBoundingClientRect().top + window.scrollY;
        const head = top;
        if (insideScrubbed(head)) continue;
        const overflow = section.offsetHeight - viewport;
        const foot = top + section.offsetHeight - viewport;

        /* A section that overruns the screen by a hair - a line of type, a
           row of padding - rests on its foot instead of its head. Resting on
           the head would put that hair below the fold, and it is always the
           last thing in the section: a route's call to action, a desk's
           footer. Giving it a second stop instead would spend a whole swipe
           travelling nine pixels. */
        if (overflow > 0 && overflow <= FOOT_STOP_MIN) {
          if (!insideScrubbed(foot)) raw.push(foot);
          continue;
        }

        raw.push(head);
        // Beyond that the section is genuinely two screens of reading, and
        // the foot is a stop of its own.
        if (overflow > FOOT_STOP_MIN && !insideScrubbed(foot)) raw.push(foot);
      }
      raw.push(maxScroll);

      const edges = raw
        .map((y) => Math.min(Math.max(0, Math.round(y)), maxScroll))
        .sort((a, b) => a - b)
        .filter((y, i, list) => i === 0 || y - list[i - 1] > REST_EPSILON);

      // Everything between the sections is scrollable too - the cinematic
      // runway, the masthead, the ticker - and none of it is a section, so
      // the first swipe of the page used to cross it whole: two and a bit
      // screens in one gesture. Long gaps are divided into equal screens.
      stops = [];
      for (let i = 0; i < edges.length; i += 1) {
        stops.push(edges[i]);
        const gap = (edges[i + 1] ?? edges[i]) - edges[i];
        if (gap <= viewport * MAX_STEP_SCREENS) continue;
        // A gap that begins inside a scrubbed runway is that runway's tail -
        // the handoff it plays after its last beat. Filling it drops a rest
        // into a scene already being carried off the screen.
        if (insideScrubbed(edges[i])) continue;
        const steps = Math.ceil(gap / viewport);
        for (let k = 1; k < steps; k += 1) {
          stops.push(Math.round(edges[i] + (gap * k) / steps));
        }
      }
    };

    const moveTo = (index: number) => {
      const to = stops[index];
      if (Math.abs(to - window.scrollY) <= REST_EPSILON) {
        origin = null;
        return;
      }
      animating = true;
      lenis.scrollTo(to, {
        // Paced by distance: the intro hands off over two screens in one
        // gesture, and carrying that at a single-screen's duration reads as
        // a cut rather than a move.
        duration: Math.min(
          SNAP_DURATION_MAX,
          SNAP_DURATION *
            Math.max(1, Math.abs(to - window.scrollY) / window.innerHeight)
        ),
        // Holds the reader's input for the length of the move, which is what
        // makes a gesture worth exactly one section.
        lock: true,
        onComplete: () => {
          animating = false;
          origin = null;
        },
      });
    };

    /**
     * Fired the moment a gesture has moved far enough to have a direction -
     * not when it finishes. Waiting for the flick to settle meant Lenis had
     * already carried the page a full screen under its own inertia, and the
     * snap then added the next stop on top: one swipe, two screens. Taking
     * the gesture at its start and paging from where it BEGAN is what makes
     * one swipe worth exactly one stop.
     */
    const page = (direction: 1 | -1) => {
      if (origin === null) return;
      const next = Math.min(Math.max(origin + direction, 0), stops.length - 1);
      moveTo(next);
    };

    /**
     * A gesture that never earned a page is simply left where it stopped.
     *
     * It used to be pulled back to where it started, which meant a reader
     * nudging the page a few lines - to see the rest of a paragraph, to look
     * at a card - was dragged back and forth against their own hand. Paging
     * is for a decisive swipe; below that the page is theirs to move.
     */
    const settle = () => {
      origin = null;
    };

    /* Sideways gestures are not page turns.
     *
     * The desks are horizontal carousels, and a two-finger swipe across one -
     * or a thumb dragged across a card - is never perfectly level: it carries
     * a few pixels of vertical delta with it. Measured only as travel, that
     * was enough to turn the page under the reader while they were moving
     * sideways. So the gesture's own axis is watched, and while it is the
     * horizontal one the pager stays out of the way.
     */
    let sideways = false;
    let axisX = 0;
    let axisY = 0;
    let axisTimer = 0;
    let touchX = 0;
    let touchY = 0;

    const resetAxis = () => {
      axisX = 0;
      axisY = 0;
      sideways = false;
    };

    const onWheel = (event: WheelEvent) => {
      axisX += Math.abs(event.deltaX);
      axisY += Math.abs(event.deltaY);
      sideways = axisX > axisY * AXIS_DOMINANCE;
      window.clearTimeout(axisTimer);
      axisTimer = window.setTimeout(resetAxis, AXIS_RESET_MS);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchX = touch.clientX;
      touchY = touch.clientY;
      window.clearTimeout(axisTimer);
      resetAxis();
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      axisX = Math.abs(touch.clientX - touchX);
      axisY = Math.abs(touch.clientY - touchY);
      sideways = axisX > axisY * AXIS_DOMINANCE;
    };

    const onTouchEnd = () => {
      window.clearTimeout(axisTimer);
      axisTimer = window.setTimeout(resetAxis, AXIS_RESET_MS);
    };

    const onScroll = () => {
      if (animating || lenis.isStopped || stops.length < 2) return;

      const y = window.scrollY;

      if (origin === null) {
        /* Measured at the head of every gesture, not once on mount: the desks
           fetch their topics and the runway's marks land as the reader moves,
           so the page above them grows by a hundred pixels after the stops
           were first taken. Stale by that much, a section edge rests with its
           last line under the fold. */
        measure();
        originY = y;
        // A jump larger than a screen and a half is not a gesture - a hash
        // link, a dragged scrollbar, a restored position. It keeps its
        // landing place and only re-seats onto the nearest stop.
        origin = nearest(originY);
      }

      const travelled = y - originY;
      if (Math.abs(travelled) > window.innerHeight * LONG_JUMP_SCREENS) {
        window.clearTimeout(settleTimer);
        origin = nearest(y);
        originY = y;
        moveTo(origin);
        return;
      }

      window.clearTimeout(settleTimer);
      // Sideways: the reader is working a carousel, not turning a page. The
      // few pixels of vertical drift the gesture carries are left where they
      // are rather than answered with a page - and not undone either, since
      // yanking the page back mid-carousel is its own kind of rude.
      if (sideways) {
        origin = nearest(y);
        originY = y;
        return;
      }
      if (Math.abs(travelled) >= gestureThreshold()) {
        page(travelled > 0 ? 1 : -1);
        return;
      }
      settleTimer = window.setTimeout(settle, SETTLE_MS);
    };

    observer.observe(document.documentElement);
    observer.observe(root);

    measure();
    // Web fonts reflow every heading on the page; the edges they settle at are
    // the ones worth resting on.
    void document.fonts?.ready.then(() => measure());
    lenis.on('scroll', onScroll);
    window.addEventListener('resize', measure);
    window.addEventListener(SNAP_STOPS_EVENT, measure);
    // Passive: these only read the gesture's axis, they never cancel it.
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(axisTimer);
      observer.disconnect();
      lenis.off('scroll', onScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener(SNAP_STOPS_EVENT, measure);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, lenis, rootRef]);
}
