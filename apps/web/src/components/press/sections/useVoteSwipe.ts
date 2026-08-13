'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeskDragLock } from './deskDragLock';
import { resolveSwipe, type SwipeIntent } from './voteSwipe';

/**
 * Sideways travel before a tile is being voted rather than merely touched.
 *
 * There used to be a press-and-hold in front of this: the desk's two axes were
 * both spoken for - sideways dragged the carousel, downwards scrolled the page
 * - so a tile could only claim the pointer by first proving the reader was not
 * scrolling. It proved the wrong thing. A gesture nobody performs by accident
 * is also a gesture nobody performs on purpose: readers never found it, and a
 * ballot you cannot find is not a ballot.
 *
 * So the tile takes sideways outright, and the carousel gives it up - it
 * drifts on its own and the municipality tuner steers it, so dragging tiles
 * was never the only way through the river. Down still has to share with the
 * page, which is why it asks for more travel below.
 */
const AXIS_PX = 9;

/** How long the cast stays stamped on the tile before it settles back. */
const STAMP_MS = 520;

export type SwipePhase = 'idle' | 'armed' | 'cast';

interface UseVoteSwipeOptions {
  /** Fired once, on release past the commit distance. */
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
  /** Far enough that letting go now casts it - the tile says so. */
  ready: boolean;
}

/**
 * The swipe-vote gesture on one tile.
 *
 * Push the tile: right is בעד, left is נגד, down sets the topic aside as not
 * a matter of consensus. Release past the commit distance and it lands;
 * release short and the tile springs back having said nothing.
 *
 * Sideways belongs to the tile under a finger, and to the desk under a cursor:
 * a thumb has one tile and one river beneath it and loses nothing by lending
 * sideways to the ballot, while dragging the river is the first thing a cursor
 * tries. Downwards is shared with the
 * page: on a touchscreen `touch-action: pan-y` means the browser takes a
 * vertical pan before this ever sees it, so setting a topic aside by pushing
 * down is a pointer gesture (mouse, trackpad, pen). The tile's headline opens
 * the whole topic for everyone else, and the ballot inside it is the door that
 * is always there.
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
    /** Whether the pointer in hand is a cursor - see the axis test below. */
    let byMouse = false;
    let originX = 0;
    let originY = 0;
    let box = { width: 0, height: 0 };
    let live: SwipeIntent | null = null;
    let progress = 0;
    let captured = false;
    /* A gesture that armed must not also fire the headline button under the
       reader's finger when they let go. */
    let swallowClick = false;

    const disarm = () => {
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

    const arm = () => {
      const el2 = ref.current;
      if (!el2) return;
      armed = true;
      swallowClick = true;
      restoreTransform.current = el2.style.transform;
      reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const rect = el2.getBoundingClientRect();
      box = { width: rect.width, height: rect.height };
      /* Hold the track still for the length of the gesture: Embla reads this
         on every pointer down, so a second finger cannot start it moving. */
      dragLock.lock();
      setPhase('armed');
    };

    const onPointerDown = (evt: PointerEvent) => {
      if (disabledRef.current) return;
      if (evt.pointerType === 'mouse' && evt.button !== 0) return;
      if (armed || pointerId !== null) return;
      pointerId = evt.pointerId;
      byMouse = evt.pointerType === 'mouse';
      originX = evt.clientX;
      originY = evt.clientY;
      swallowClick = false;
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (pointerId !== evt.pointerId) return;
      const dx = evt.clientX - originX;
      const dy = evt.clientY - originY;

      if (!armed) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_PX) return;
        /* Sideways is a vote and the tile takes it. Downwards is the page's,
           unless the reader keeps pulling: past twice the axis threshold with
           the pull still mostly vertical, they mean the tile. Upwards is
           always the page - there is nothing to say in that direction. */
        const sideways = Math.abs(dx) > Math.abs(dy);
        /* Except under a mouse, where sideways is the desk's.
           A thumb has one river and one tile under it, and taking sideways
           for the ballot costs the reader nothing they had - the desk drifts
           on its own and the tuner steers it. A cursor is the other way
           round: dragging the river is the obvious thing to try, it is how
           every other carousel on the web behaves, and a desk that refuses
           the drag reads as broken. The ballot is still one click away in
           the tile's own dialog, and the downward set-aside still answers
           the mouse. */
        if (sideways && byMouse) return;
        if (!sideways && !(dy > AXIS_PX * 2)) return;
        arm();
        if (!armed) return;
      }

      /* Capture after arming rather than at pointer-down, so an ordinary
         scroll that merely started on a tile is never re-targeted here. */
      if (!captured) {
        captured = true;
        try {
          el.setPointerCapture(evt.pointerId);
        } catch {
          /* Capture is a convenience; the gesture still tracks without it. */
        }
      }

      const reading = resolveSwipe(dx, dy, box, rtlRef.current);
      const wasReady = progress >= 1;
      progress = reading.progress;
      if (reading.intent !== live) {
        live = reading.intent;
        setIntent(reading.intent);
      }
      // Two discrete facts reach React out of a stream of moves: which way,
      // and whether letting go now would land it.
      if (progress >= 1 !== wasReady) setReady(progress >= 1);
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
      if (pointerId !== evt.pointerId) return;
      const cast = armed && live && progress >= 1 ? live : null;
      const wasArmed = armed;
      disarm();
      setReady(false);

      if (cast) {
        setIntent(cast);
        setPhase('cast');
        commitRef.current(cast);
        window.setTimeout(() => {
          setPhase('idle');
          setIntent(null);
        }, STAMP_MS);
        return;
      }

      setPhase('idle');
      setIntent(null);
      // A push that fell short is not a tap either: the reader started to say
      // something and stopped, so the tile does nothing at all.
      if (!wasArmed) swallowClick = false;
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
    el.addEventListener('contextmenu', suppress, nonPassive);
    // Capture phase: the headline button must not see the click at all.
    el.addEventListener('click', onClick, true);

    return () => {
      if (armed) dragLock.release();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('touchmove', suppress);
      el.removeEventListener('mousemove', suppress);
      el.removeEventListener('contextmenu', suppress);
      el.removeEventListener('click', onClick, true);
    };
  }, [clear, dragLock, paint]);

  return { ref, phase, intent, ready };
}
