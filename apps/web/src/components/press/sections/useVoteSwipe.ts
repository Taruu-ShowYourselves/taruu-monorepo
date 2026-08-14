'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chime, primeChime } from '@/lib/feedback/chime';
import { useDeskDragLock } from './deskDragLock';
import { HOLD_MS, holdCount, resolveSwipe, type SwipeIntent } from './voteSwipe';

/**
 * The press that turns a tile from headline into ballot.
 *
 * The tile used to take sideways travel outright, which meant every attempt
 * to swipe the carousel grabbed whatever tile happened to be under the
 * finger instead - the reader pulled cards when they meant to pull the
 * river. So the two gestures are split by time rather than by axis: a swipe
 * that starts moving straight away is the carousel's, and a finger that
 * rests on a tile for a beat first is opening its ballot. The tile lifts
 * and pops when the press lands, so vote mode announces itself.
 */
const PRESS_MS = 600;

/**
 * How far a pressing pointer may wander and still be "resting". Beyond this
 * before the press lands, the reader is swiping - the press cancels and the
 * carousel keeps the gesture.
 */
const PRESS_SLOP_PX = 10;

/** How long the cast stays stamped on the tile before it settles back. */
const STAMP_MS = 520;

export type SwipePhase = 'idle' | 'armed' | 'cast';

interface UseVoteSwipeOptions {
  /** Fired once, when the be-sure hold completes at full push. */
  onCommit: (intent: SwipeIntent) => void;
  /** Hebrew prints בעד at the right edge, English prints For at the left. */
  rtl?: boolean;
  disabled?: boolean;
}

interface VoteSwipe<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  phase: SwipePhase;
  /** What the current push says, or what the last one said while it stamps. */
  intent: SwipeIntent | null;
  /** Far enough that the be-sure hold is running - the tile says so. */
  ready: boolean;
  /**
   * The digit of the be-sure countdown (3, 2, 1) while a push is being held
   * past the commit distance, or null when no hold is running. The cast lands
   * when the count runs out; releasing earlier is a change of mind.
   */
  hold: number | null;
}

/**
 * The press-then-swipe ballot gesture on one tile.
 *
 * Rest a finger (or a pressed mouse) on the tile for PRESS_MS and it arms:
 * it lifts, pops, and now follows the pointer. Push right for בעד, left for
 * נגד, down to set the topic aside. Hold the push past the commit distance
 * and a 3-2-1 prints on the tile; the cast lands when the count runs out.
 * Release earlier and the tile springs back having said nothing.
 *
 * Before the press lands, the pointer belongs to everyone else: a gesture
 * that starts moving within the slop is the carousel's swipe or the page's
 * scroll, and a quick tap is the headline's click. The tile only ever claims
 * a pointer that chose to stay.
 *
 * Everything continuous is written straight to the element as custom
 * properties rather than through state - a pointer move is 120 renders a
 * second otherwise, on a card that is one of a dozen live ones. React only
 * hears about the discrete facts a tile's markup depends on: whether it is
 * armed, which way it is being pushed, whether letting go would land it, and
 * what it just cast.
 *
 * The gesture is a shortcut, never the only door. Every tile's headline is a
 * real button onto the whole topic and its full ballot, which is what a
 * keyboard and a screen reader use; nothing here is reachable only by pushing.
 */
export function useVoteSwipe<T extends HTMLElement>({
  onCommit,
  rtl = true,
  disabled = false,
}: UseVoteSwipeOptions): VoteSwipe<T> {
  const ref = useRef<T>(null);
  const dragLock = useDeskDragLock();
  const [phase, setPhase] = useState<SwipePhase>('idle');
  const [intent, setIntent] = useState<SwipeIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [hold, setHold] = useState<number | null>(null);

  // Listeners are attached once for the life of the tile, so everything they
  // read that can change between renders goes through a ref.
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const rtlRef = useRef(rtl);
  rtlRef.current = rtl;

  /**
   * The push is written straight onto the element's inline transform, not
   * through a class.
   *
   * The desk's reveal animation leaves its own inline `transform` on every
   * tile, and an inline declaration beats any stylesheet rule - a transform
   * set in the CSS module simply never applied, so an armed tile lit up and
   * tinted but would not move. The custom properties still carry the tint and
   * the tilt so the stylesheet keeps owning what things look like; only the
   * one property that was already inline is set from here.
   */
  const reduced = useRef(false);
  const restoreTransform = useRef<string>('');

  const paint = useCallback((x: number, y: number, progress: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--swipe-x', `${x}px`);
    el.style.setProperty('--swipe-y', `${y}px`);
    // A little roll off the vertical: enough for the tile to read as a
    // physical thing being pushed, not enough to fight the type on it.
    const rot = reduced.current ? 0 : x / 26;
    el.style.setProperty('--swipe-rot', `${rot.toFixed(2)}deg`);
    /* The tint is mixed in JS rather than with calc() inside color-mix(),
       which is uneven across the browsers this ships to. It stops short of
       the full colour on purpose: a tile at 100% red is a tile whose headline
       cannot be read, and the reader is still deciding at this point. The
       undiluted colour arrives with the wash, once the push is far enough to
       land. */
    el.style.setProperty('--swipe-mix', `${Math.round(progress * 78)}%`);
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot.toFixed(2)}deg)`;
  }, []);

  const clear = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    for (const prop of ['--swipe-x', '--swipe-y', '--swipe-rot', '--swipe-mix']) {
      el.style.removeProperty(prop);
    }
    // Back to whatever the reveal animation left, not to nothing.
    el.style.transform = restoreTransform.current;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let armed = false;
    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;
    /* Where the pointer last was - the origin the push measures from once the
       press arms, so the wander the slop allowed is not counted as push. */
    let lastX = 0;
    let lastY = 0;
    /* The press that arms vote mode. Runs from pointer down; cancelled by
       wandering past the slop, by release, or by the pointer being lost. */
    let pressTimer: number | null = null;
    let box = { width: 0, height: 0 };
    let live: SwipeIntent | null = null;
    let progress = 0;
    let captured = false;
    /* A gesture that armed must not also fire the headline button under the
       reader's finger when they let go. */
    let swallowClick = false;

    /* ---- The be-sure hold -------------------------------------------------
       A push at full distance no longer lands on release; it lands when it has
       been held there for HOLD_MS. The countdown runs on its own timer because
       a finger holding still sends no more pointer events - the moment the
       push crosses the line is the last thing the move handler sees. */
    let holdTimer: number | null = null;
    let holdStart = 0;
    let holdIntent: SwipeIntent | null = null;
    /* The stamp's settle-back, tracked so a re-push inside the stamp window
       cannot have its fresh phase wiped by the previous cast's timeout. */
    let stampTimer: number | null = null;
    /* On touch, an armed drag suppresses the browser's click entirely, so the
       capture-phase click handler never consumes `swallowClick` and the flag
       used to stay armed forever - eating the first genuine tap that followed
       (measured on the share chip, whose own pointerdown no longer reaches
       the tile's reset). The gesture's click, if it comes at all, comes right
       after the release; anything later is a new tap and must land. */
    let swallowTimer: number | null = null;

    const releaseSwallowSoon = () => {
      if (swallowTimer !== null) window.clearTimeout(swallowTimer);
      swallowTimer = window.setTimeout(() => {
        swallowClick = false;
        swallowTimer = null;
      }, 300);
    };

    const cancelHold = () => {
      if (holdTimer !== null) {
        window.clearInterval(holdTimer);
        holdTimer = null;
      }
      holdIntent = null;
      setHold(null);
      ref.current?.style.removeProperty('--hold-t');
    };

    const cancelPress = () => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const disarm = () => {
      cancelPress();
      cancelHold();
      if (armed) dragLock.release();
      armed = false;
      if (captured && pointerId !== null) {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* Already released with the pointer itself. */
        }
      }
      captured = false;
      pointerId = null;
      live = null;
      progress = 0;
      clear();
    };

    /* The cast, fired by the countdown running out - not by the release.
       Disarming first hands the pointer back, so the finger still resting on
       the tile cannot keep steering a ballot that has already been counted. */
    const castNow = (cast: SwipeIntent) => {
      /* The countdown's tick is not a gesture, so the chime rides on the
         context the arming gesture woke. */
      chime('success');
      disarm();
      setReady(false);
      setIntent(cast);
      setPhase('cast');
      commitRef.current(cast);
      if (stampTimer !== null) window.clearTimeout(stampTimer);
      stampTimer = window.setTimeout(() => {
        stampTimer = null;
        setPhase('idle');
        setIntent(null);
      }, STAMP_MS);
    };

    const startHold = (cast: SwipeIntent) => {
      cancelHold();
      holdIntent = cast;
      holdStart = performance.now();
      setHold(holdCount(0));
      holdTimer = window.setInterval(() => {
        const elapsed = performance.now() - holdStart;
        /* The dial's sweep is painted straight onto the element; React only
           hears the digit change - the same discipline as the push itself. */
        ref.current?.style.setProperty(
          '--hold-t',
          Math.min(1, elapsed / HOLD_MS).toFixed(3)
        );
        if (elapsed >= HOLD_MS) {
          castNow(cast);
          return;
        }
        setHold(holdCount(elapsed));
      }, 50);
    };

    const arm = () => {
      const el2 = ref.current;
      if (!el2 || pointerId === null) return;
      /* A fresh gesture must not have its phase wiped mid-push by the last
         cast's stamp settling back. */
      if (stampTimer !== null) {
        window.clearTimeout(stampTimer);
        stampTimer = null;
      }
      armed = true;
      swallowClick = true;
      restoreTransform.current = el2.style.transform;
      reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const rect = el2.getBoundingClientRect();
      box = { width: rect.width, height: rect.height };
      /* The push measures from where the finger is NOW: the wander the slop
         forgave must not arrive as a head start on the ballot. */
      originX = lastX;
      originY = lastY;
      /* Vote mode announces itself - the pop is the tile saying "you have
         me". The timer is not a gesture, but the pointerdown that started it
         primed the context. */
      chime('pop');
      /* From here the pointer is the ballot's: capture re-targets the moves
         to the tile, and the drag lock keeps a second finger from sliding
         the track under the push. */
      captured = true;
      try {
        el2.setPointerCapture(pointerId);
      } catch {
        /* Capture is a convenience; the gesture still tracks without it. */
      }
      dragLock.lock();
      setPhase('armed');
    };

    const onPointerDown = (evt: PointerEvent) => {
      if (disabledRef.current) return;
      if (evt.pointerType === 'mouse' && evt.button !== 0) return;
      if (armed || pointerId !== null) return;
      pointerId = evt.pointerId;
      /* Chimes fire from timers all through this gesture, and WebKit only
         lets an audio context start inside an activation event - pointerdown
         is one. So the context is woken here, on the touch itself. */
      primeChime();
      originX = evt.clientX;
      originY = evt.clientY;
      lastX = evt.clientX;
      lastY = evt.clientY;
      swallowClick = false;
      if (swallowTimer !== null) {
        window.clearTimeout(swallowTimer);
        swallowTimer = null;
      }
      /* The press: stay put for PRESS_MS and the tile arms. Move first and
         the timer dies with the gesture still belonging to the carousel. */
      cancelPress();
      pressTimer = window.setTimeout(() => {
        pressTimer = null;
        arm();
      }, PRESS_MS);
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (pointerId !== evt.pointerId) return;
      lastX = evt.clientX;
      lastY = evt.clientY;
      const dx = evt.clientX - originX;
      const dy = evt.clientY - originY;

      if (!armed) {
        /* A pointer still inside the slop is resting, not swiping - the
           press keeps counting. One that leaves it is a swipe or a scroll:
           the press cancels and the tile never touches the gesture again. */
        if (Math.max(Math.abs(dx), Math.abs(dy)) > PRESS_SLOP_PX) cancelPress();
        return;
      }

      const reading = resolveSwipe(dx, dy, box, rtlRef.current);
      const wasReady = progress >= 1;
      progress = reading.progress;
      if (reading.intent !== live) {
        live = reading.intent;
        setIntent(reading.intent);
      }
      // Two discrete facts reach React out of a stream of moves: which way,
      // and whether the be-sure count is running.
      if (progress >= 1 !== wasReady) setReady(progress >= 1);

      /* The be-sure mechanism. At full push the countdown runs; drop back
         under the commit distance and it stops, because the reader is no
         longer saying it. Changing sides mid-hold restarts the three seconds
         for the new answer - a count begun for בעד must not land a נגד. */
      if (progress >= 1 && live) {
        if (holdIntent !== live) startHold(live);
      } else if (holdTimer !== null) {
        cancelHold();
      }
      // Sideways pushes stay on their axis and vertical ones on theirs: a tile
      // that follows the pointer diagonally reads as a loose object rather
      // than as an answer being given.
      paint(
        reading.intent === 'aside' ? 0 : dx,
        reading.intent === 'aside' ? Math.max(0, dy) : 0,
        progress
      );
    };

    const onPointerUp = (evt: PointerEvent) => {
      /* A gesture the countdown already cast has disarmed itself: pointerId is
         null by the time the finger lifts, and the guard drops the release -
         but the click that may trail this release still belongs to the
         gesture, so the swallow gets its expiry here rather than staying
         armed forever. */
      if (pointerId !== evt.pointerId) {
        if (swallowClick) releaseSwallowSoon();
        return;
      }

      /* Releasing no longer casts anything. A push held for the full count has
         landed before the finger lifts; letting go mid-count - or short of the
         line - is the reader deciding not to say it, and the tile springs back
         having said nothing. */
      const wasArmed = armed;
      disarm();
      setReady(false);
      setPhase('idle');
      setIntent(null);
      // A push that fell short is not a tap either: the reader started to say
      // something and stopped, so the tile does nothing at all. Its swallow
      // still expires - on touch no click ever comes to consume it, and a
      // flag left armed eats the next honest tap on the tile's own controls.
      if (wasArmed) releaseSwallowSoon();
      else swallowClick = false;
    };

    /* Embla listens for touchmove on the carousel root and mousemove on the
       document, and the browser scrolls the page on an unclaimed touchmove.
       Both are ancestors of this tile, so while a gesture is armed the tile
       simply does not let the move past it. This is also why these two are
       registered non-passive: preventDefault on a passive listener is a
       no-op, and the page would scroll out from under the push. */
    const suppress = (evt: Event) => {
      if (!armed) return;
      evt.stopPropagation();
      if (evt.cancelable) evt.preventDefault();
    };

    /* The long-press that arms the ballot is exactly the press that summons
       a context menu on touch (and the callout on iOS), so the menu is
       declined while a press is counting as well as while armed. Scroll and
       swipe suppression above stays armed-only: preventDefault on the first
       touchmove of a press would abort the browser's whole pan, and a
       gesture that leaves the slop belongs to the page. */
    const suppressMenu = (evt: Event) => {
      if (!armed && pressTimer === null) return;
      evt.stopPropagation();
      if (evt.cancelable) evt.preventDefault();
    };

    const onClick = (evt: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      evt.stopPropagation();
      evt.preventDefault();
    };

    const nonPassive = { passive: false } as const;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('touchmove', suppress, nonPassive);
    el.addEventListener('mousemove', suppress, nonPassive);
    el.addEventListener('contextmenu', suppressMenu, nonPassive);
    // Capture phase: the headline button must not see the click at all.
    el.addEventListener('click', onClick, true);

    return () => {
      if (pressTimer !== null) window.clearTimeout(pressTimer);
      if (holdTimer !== null) window.clearInterval(holdTimer);
      if (stampTimer !== null) window.clearTimeout(stampTimer);
      if (swallowTimer !== null) window.clearTimeout(swallowTimer);
      if (armed) dragLock.release();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('touchmove', suppress);
      el.removeEventListener('mousemove', suppress);
      el.removeEventListener('contextmenu', suppressMenu);
      el.removeEventListener('click', onClick, true);
    };
  }, [clear, dragLock, paint]);

  return { ref, phase, intent, ready, hold };
}
