/**
 * Israel outline + the projection that puts a municipality on it.
 *
 * The outline is a stylised (horizontally compressed) silhouette, so pins
 * are placed by fitting a plain equirectangular projection to the drawing's
 * own bounding box rather than to true geodesy: the geographic bounds below
 * are the ones that make the path's extremes land where they belong
 * (southern tip ≈ Eilat, northern spur ≈ Hermon/Metula, west edge ≈ the
 * Rafah corner). Coordinates come from MUNICIPALITY_GEO - the same
 * centroids GPS resolution uses, so the map can never drift from the data.
 */

import { MUNICIPALITY_GEO, municipalityFromText } from '@sync/shared';

export interface MapPoint {
  x: number;
  y: number;
}

export const ISRAEL_MAP_PATH =
  'M40 395.7L52.8 382.4L52.2 370.6L54.9 364.5L78.5 339.2L69.1 331.8L85.2 300.4L98 268.4L113.7 211.8L126.7 135.4L127.4 120L130.3 115.3L137.4 117.8L141.8 112.4L146.4 72.9L169.4 70.6L177.1 78.4L194 72.9L202.7 39.6L209.5 46.7L221.3 32.5L230.2 29L236.6 18L235.2 26L229.5 30.4L234.2 34.2L230.1 41.1L234.4 45.2L234.9 53.3L237.8 55.3L235.4 68.7L240.1 71L241.4 89.7L245 97.5L240.2 105.9L238.3 117.6L228.7 132L213.5 143.2L210.5 142.7L204.1 149.8L206.5 163.6L203 169.6L206.5 174.4L202.1 189.6L204.1 193.9L184.8 188.7L183.1 175L179.4 172.3L167.8 172.2L157.8 166.8L139.6 185.4L136.7 200.8L133.5 204.5L132.7 212.1L135.1 214L134.9 218L129.1 225.4L134.9 256.5L132.3 265.7L138.8 275.8L138.3 284L131.2 288.7L143.5 285.1L148 290.3L157.2 293L156.9 290.1L160.9 291L159.6 281.2L161.7 280.8L163.1 287.1L167.1 289.9L166.8 303.3L163.7 310.1L149.7 306L130.7 323.7L126.1 332L124.8 347L117.4 363.9L118.8 369.7L124.9 372.8L154.6 369.8L182.7 348.3L191.3 347.5L190.6 363.2L183.4 387.8L188.5 404.7L188.8 414.3L182.9 428L182.1 438.4L174.3 451.1L173.6 462.6L168.9 469.9L159.6 498L151.5 530.2L154.2 542L149.6 562.1L152.1 583L144.8 598.3L132.7 664.1L127.9 682.4L122.8 692L119.8 691.9L115.9 682.4L112 648.6L101.6 614.5L100.6 602L83.9 544.9L74.8 533.7L76 521.2L72 512.9L69 492.1L40 395.7Z';

export const MAP_VIEWBOX = '-20 0 360 710';

/** Bounding box the outline actually occupies inside the viewBox. */
const FRAME = { x: 40, y: 18, width: 205, height: 674 } as const;

/** Geographic bounds that box represents. */
const BOUNDS = { west: 34.27, east: 35.9, north: 33.34, south: 29.49 } as const;

export function projectLatLng(lat: number, lng: number): MapPoint {
  return {
    x:
      FRAME.x +
      ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * FRAME.width,
    y:
      FRAME.y +
      ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * FRAME.height,
  };
}

const POINT_BY_NAME = new Map<string, MapPoint>(
  MUNICIPALITY_GEO.map((muni) => [muni.name, projectLatLng(muni.lat, muni.lng)])
);

/**
 * Municipality name (canonical, alias or free text) → map point.
 * Unknown scopes return null: an unplaceable topic is left off the map
 * rather than pinned somewhere it isn't.
 */
export function pointForMunicipality(name: string): MapPoint | null {
  const known = POINT_BY_NAME.get(name);
  if (known) return known;
  const resolved = municipalityFromText(name);
  return resolved ? POINT_BY_NAME.get(resolved.name) ?? null : null;
}

/** Bottom edge of the viewBox, where pin leader lines terminate. */
export const MAP_BOTTOM_Y = 710;

/** A signal that resolved to a place on the map. */
export interface CityPlaced<T> {
  signal: T;
  point: MapPoint;
}

/**
 * Place heat-sorted signals on the map, round-robin by municipality: every
 * placeable city surfaces its hottest topic before any city gets a second
 * slot. A straight top-N cut lets one loud city's backlog fill the whole
 * window and starve every other pin off the map.
 */
export function interleaveByCity<T extends { municipality: string }>(
  signals: readonly T[],
  cap: number
): CityPlaced<T>[] {
  const buckets = new Map<string, CityPlaced<T>[]>();
  for (const signal of signals) {
    if (!signal.municipality) continue;
    const point = pointForMunicipality(signal.municipality);
    if (!point) continue;
    const bucket = buckets.get(signal.municipality);
    if (bucket) bucket.push({ signal, point });
    else buckets.set(signal.municipality, [{ signal, point }]);
  }

  // Bucket iteration order is first-appearance order, which under a
  // heat-sorted input is the cities ranked by their own hottest topic.
  const placed: CityPlaced<T>[] = [];
  for (let rank = 0; placed.length < cap; rank += 1) {
    let took = false;
    for (const bucket of buckets.values()) {
      if (rank >= bucket.length) continue;
      placed.push(bucket[rank]);
      took = true;
      if (placed.length === cap) break;
    }
    if (!took) break;
  }
  return placed;
}
