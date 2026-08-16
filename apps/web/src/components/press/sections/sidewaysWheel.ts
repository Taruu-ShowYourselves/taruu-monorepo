'use client';

/**
 * A sideways wheel or trackpad gesture, read as detents.
 *
 * Both instruments on the desk take the same gesture - the river moves a tile,
 * the dial moves a station - and both had the same problem when they read it
 * naively. A trackpad flick is not one event of 300 pixels; it is forty events
 * of eight, and then a second of momentum that keeps sending them after the
 * fingers have left the glass. Counting raw travel turned one flick into a
 * dozen detents and the desk bolted.
 *
 * So a gesture yields ONE detent, and asking for the next one means pushing
 * again. Three rules do it:
 *
 *   - travel is accumulated until it passes `stepPx`, so a small push is not
 *     answered at all and a large one is answered once;
 *   - after a detent the instrument is deaf for `cooldownMs`, which is longer
 *     than the tail of momentum a flick leaves behind;
 *   - a pause of `quietMs` with no sideways travel ends the gesture, so the
 *     next push starts from nothing rather than from what was left over.
 *
 * A reader who wants to travel a long way pushes repeatedly, which is how
 * every physical dial with detents behaves.
 */

export interface SidewaysWheelOptions {
  /** Sideways travel that makes one detent. */
  stepPx: number;
  /** How long the instrument ignores the wheel after a detent. */
  cooldownMs: number;
  /** Stillness that ends a gesture and clears its accumulated travel. */
  quietMs: number;
  /**
   * One detent. `forward` is a push that carries the content the way reading
   * runs - the next tile, the next station.
   */
  onStep: (forward: boolean) => void;
}

/**
 * Builds the wheel listener. Register it non-passive: the handler swallows
 * every sideways gesture it takes, both from the browser's own horizontal pan
 * and from the page's smooth scroll, which reads the wheel on an ancestor and
 * does not consult `defaultPrevented`.
 */
export function sidewaysWheel({
  stepPx,
  cooldownMs,
  quietMs,
  onStep,
}: SidewaysWheelOptions): (event: WheelEvent) => void {
  let travel = 0;
  let last = 0;
  let deafUntil = 0;

  return (event: WheelEvent) => {
    /* Shift+wheel is how a mouse with a single wheel says sideways, and the
       browsers disagree about which axis to report it on: Chrome moves it to
       deltaX, Firefox leaves it on deltaY. */
    const sideways = event.shiftKey
      ? Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY
      : event.deltaX;
    // Anything else on the vertical is the page's.
    if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }
    if (!sideways) return;

    event.preventDefault();
    event.stopPropagation();

    const now = event.timeStamp;
    // Still inside a detent's shadow: the tail of the same flick.
    if (now < deafUntil) return;
    // A fresh gesture, or one that turned round, starts from nothing.
    if (now - last > quietMs || Math.sign(sideways) !== Math.sign(travel)) {
      travel = 0;
    }
    last = now;

    travel += sideways;
    if (Math.abs(travel) < stepPx) return;

    const forward = travel < 0;
    travel = 0;
    deafUntil = now + cooldownMs;
    onStep(forward);
  };
}
