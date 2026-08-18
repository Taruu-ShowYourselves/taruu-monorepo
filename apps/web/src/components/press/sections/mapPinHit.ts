/**
 * Which town a tap on the live map means.
 *
 * The map draws one pin per town at its projected point, and the country is
 * small: Bat Yam and Holon land 5.3 map units apart, which is under 3 CSS
 * pixels on a phone. A hit disc per pin therefore overlaps its neighbours,
 * and SVG resolves an overlap by paint order - so the tap went to whichever
 * town was drawn last rather than to the one under the finger. Pins are
 * painted hottest-first, which made the busiest town the hardest to reach.
 *
 * The rule here is the one a reader already assumes: the tap belongs to the
 * pin nearest to it, and to no pin at all when the nearest is further away
 * than a fingertip. Nothing about the drawing takes part in the decision.
 */

/**
 * Half of the ~44px target a fingertip needs, in CSS pixels. The map is
 * drawn in its own units and its scale changes with the viewport, so the
 * caller converts this to map units against the live rendering - the target
 * stays the same physical size on a phone and on a desk.
 */
export const MAP_TAP_RADIUS_PX = 22;

export interface MapHitPoint {
  x: number;
  y: number;
}

/**
 * The pin nearest to `point`, or null when the nearest one is further than
 * `radius` away. Distances are squared - only the ordering matters, and a
 * comparison against the radius is exact either way.
 */
export function nearestPinWithin<Pin extends MapHitPoint>(
  pins: readonly Pin[],
  point: MapHitPoint,
  radius: number
): Pin | null {
  let nearest: Pin | null = null;
  let nearestDistance = radius * radius;

  for (const pin of pins) {
    const dx = pin.x - point.x;
    const dy = pin.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance <= nearestDistance) {
      /* Strictly nearer wins; an exact tie keeps the earlier pin, so the
         answer never depends on the order the pins arrived in. */
      if (nearest !== null && distance === nearestDistance) continue;
      nearest = pin;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * The affine transform an SVG reports from `getScreenCTM()` - map units to
 * client pixels. Narrowed to the six numbers so the arithmetic below is
 * plain and testable without a DOM.
 */
export interface MapScreenMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * A tap, in client pixels, put back into map units - plus how many pixels
 * one map unit currently covers, which is what turns a fingertip into a
 * threshold the map can compare against.
 *
 * Inverting the matrix by hand rather than through `DOMMatrix.inverse()`
 * keeps the whole decision in ordinary arithmetic: the same numbers a
 * browser reports, checkable in a unit test with no SVG DOM in sight.
 */
export function mapPointFromClient(
  matrix: MapScreenMatrix,
  clientX: number,
  clientY: number
): { point: MapHitPoint; pxPerUnit: number } | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  /* A degenerate matrix means the map is not being drawn (display:none, a
     zero-sized box). There is no point under the finger to speak of. */
  if (determinant === 0 || !Number.isFinite(determinant)) return null;

  const dx = clientX - matrix.e;
  const dy = clientY - matrix.f;
  return {
    point: {
      x: (matrix.d * dx - matrix.c * dy) / determinant,
      y: (matrix.a * dy - matrix.b * dx) / determinant,
    },
    /* The uniform scale of the transform: the map is drawn with
       preserveAspectRatio="xMidYMid meet", so x and y share it. */
    pxPerUnit: Math.sqrt(Math.abs(determinant)),
  };
}
