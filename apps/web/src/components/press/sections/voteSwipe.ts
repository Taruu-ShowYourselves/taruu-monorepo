/**
 * What a reader is saying when they push a tile.
 *
 * Boundary-free logic, kept out of the hook and the row so both the desk and
 * the tests can reason about the gesture without a DOM: given a displacement
 * and the tile it happened on, this decides which of the three things the
 * reader is saying and how far through saying it they are.
 */

/**
 * The three answers a tile can be given without opening it.
 *
 * `for` and `against` are the two sides of the sovereign scale - the same two
 * the ballot counts. `aside` is not a position on the topic at all: it says
 * this is not a matter of consensus, which is why it carries the blue pencil
 * rather than either side's colour (see --np-blue in tokens.css).
 */
export type SwipeIntent = 'for' | 'against' | 'aside';

export interface SwipeReading {
  /** Null while the push is too small, or too ambiguous, to mean anything. */
  intent: SwipeIntent | null;
  /** 0-1 through the commit distance for that intent. 1 = release and it lands. */
  progress: number;
}

export interface SwipeBox {
  width: number;
  height: number;
}

/**
 * Slack before a push means anything.
 *
 * A tile is a tap target first - the headline opens the whole topic - so the
 * gesture has to stay clear of the wobble in an ordinary tap.
 */
export const SWIPE_DEADZONE = 10;

/**
 * How far a reader has to push before releasing casts the intent.
 *
 * Proportional to the tile so a 2x2 lead asks for a deliberate shove and a
 * 1x1 brief does not demand one longer than itself, clamped at both ends so
 * neither extreme becomes a flick or a haul.
 */
function commitDistance(span: number, ratio: number, min: number, max: number): number {
  return Math.min(Math.max(span * ratio, min), max);
}

export function horizontalCommit(box: SwipeBox): number {
  return commitDistance(box.width, 0.3, 56, 128);
}

export function verticalCommit(box: SwipeBox): number {
  return commitDistance(box.height, 0.28, 52, 112);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The be-sure hold: how long a push must be held past the commit distance
 * before it lands.
 *
 * Release-to-cast turned out to be too cheap for a ballot - a flick that
 * happened to travel far enough was counted as a position. The tile now asks
 * for three deliberate seconds at full push: a 3-2-1 prints on the tile while
 * the reader holds, the cast lands when the count reaches zero, and letting
 * go early is the reader changing their mind - the tile springs back having
 * said nothing.
 */
export const HOLD_MS = 3000;

/**
 * The digit the tile prints at this point through the hold: 3, then 2, then 1.
 *
 * Clamped on both ends so a timer that fires a frame early or late never
 * prints 0 or 4 - the zero moment is the cast itself, not a numeral.
 */
export function holdCount(elapsedMs: number): 1 | 2 | 3 {
  const left = Math.ceil((HOLD_MS - elapsedMs) / 1000);
  return Math.min(3, Math.max(1, left)) as 1 | 2 | 3;
}

/**
 * Read a push.
 *
 * The dominant axis wins outright rather than blending: a gesture that is
 * two-thirds sideways and one-third down is a side, and tinting the tile with
 * a mix of two answers would tell the reader they are casting something they
 * are not.
 *
 * Up means nothing on purpose. Three directions are already more than a tile
 * can signpost at once, and the fourth would have to invent a fourth answer
 * the ballot does not have.
 *
 * `rtl` mirrors the two sides so the push always agrees with the scale printed
 * on the tile: Hebrew prints בעד at the right edge and English prints For at
 * the left one, and in both the reader pushes toward their own side.
 */
export function resolveSwipe(
  dx: number,
  dy: number,
  box: SwipeBox,
  rtl = true
): SwipeReading {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (Math.max(ax, ay) < SWIPE_DEADZONE) return { intent: null, progress: 0 };

  if (ax >= ay) {
    const towardEnd = rtl ? dx > 0 : dx < 0;
    return {
      intent: towardEnd ? 'for' : 'against',
      progress: clamp01(ax / horizontalCommit(box)),
    };
  }

  // Up is not an answer; the tile stays where it is and says nothing.
  if (dy <= 0) return { intent: null, progress: 0 };

  return { intent: 'aside', progress: clamp01(ay / verticalCommit(box)) };
}
