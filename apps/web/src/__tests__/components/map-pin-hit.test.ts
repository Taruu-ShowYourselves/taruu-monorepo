import { describe, expect, it } from 'vitest';
import { pointForMunicipality } from '@/components/press/CinematicIntro/israel-map';
import {
  MAP_TAP_RADIUS_PX,
  mapPointFromClient,
  nearestPinWithin,
} from '@/components/press/sections/mapPinHit';

/**
 * The live map's pins are placed by geography, so the Gush Dan towns land on
 * top of one another: Bat Yam and Holon are 5.3 map units apart, which is
 * under 3 CSS pixels on a 390px phone. Painting a hit disc per pin therefore
 * hands the tap to whichever town happens to be drawn last - and the pins are
 * drawn hottest-first, so the busiest town on the map is the one buried
 * deepest. These lock the replacement rule: the tap goes to the pin nearest
 * the finger, and to nothing at all when the finger is nowhere near the map.
 */

/** Real projected pins, in the paint order the section actually renders
 *  (hottest first - so Bat Yam is bottom of the stack and Rishon LeZion,
 *  with one topic, is painted over it). */
const pinsInPaintOrder = [
  'בת ים',
  'רעננה',
  'רחובות',
  'חולון',
  'גזר',
  'תל אביב-יפו',
  'ירושלים',
  'לוד',
  'ראשון לציון',
  'באר שבע',
].map((name) => {
  const point = pointForMunicipality(name);
  if (!point) throw new Error(`no projected point for ${name}`);
  return { name, x: point.x, y: point.y };
});

const at = (name: string) => {
  const pin = pinsInPaintOrder.find((entry) => entry.name === name);
  if (!pin) throw new Error(`${name} is not in the fixture`);
  return { x: pin.x, y: pin.y };
};

/** A 390x844 phone renders the 360-unit viewBox about 188px wide. */
const MOBILE_PX_PER_UNIT = 188 / 360;
/** A 1440x900 desktop renders it about 373px wide. */
const DESKTOP_PX_PER_UNIT = 373 / 360;

const mobileRadius = MAP_TAP_RADIUS_PX / MOBILE_PX_PER_UNIT;
const desktopRadius = MAP_TAP_RADIUS_PX / DESKTOP_PX_PER_UNIT;

describe('nearestPinWithin', () => {
  it('gives Bat Yam its own tap, though every other pin is painted over it', () => {
    const hit = nearestPinWithin(pinsInPaintOrder, at('בת ים'), mobileRadius);
    expect(hit?.name).toBe('בת ים');
  });

  it('gives Holon its own tap, though Rishon LeZion is painted over it', () => {
    const hit = nearestPinWithin(pinsInPaintOrder, at('חולון'), mobileRadius);
    expect(hit?.name).toBe('חולון');
  });

  it('still selects Rishon LeZion when the tap is on Rishon LeZion', () => {
    const hit = nearestPinWithin(
      pinsInPaintOrder,
      at('ראשון לציון'),
      mobileRadius
    );
    expect(hit?.name).toBe('ראשון לציון');
  });

  it.each([
    ['לוד'],
    ['גזר'],
    ['תל אביב-יפו'],
    ['רחובות'],
    ['רעננה'],
    ['ירושלים'],
  ])('resolves the crowded neighbour %s to itself', (name) => {
    const hit = nearestPinWithin(pinsInPaintOrder, at(name), mobileRadius);
    expect(hit?.name).toBe(name);
  });

  it('selects an isolated pin from its own point', () => {
    const hit = nearestPinWithin(pinsInPaintOrder, at('באר שבע'), mobileRadius);
    expect(hit?.name).toBe('באר שבע');
  });

  it('does not let paint order decide: the same tap resolves the same way reversed', () => {
    const reversed = [...pinsInPaintOrder].reverse();
    for (const pin of pinsInPaintOrder) {
      expect(
        nearestPinWithin(reversed, { x: pin.x, y: pin.y }, mobileRadius)?.name
      ).toBe(pin.name);
    }
  });

  it('takes the nearer of an overlapping pair when the tap leans towards it', () => {
    /* A point 1.2 units off Bat Yam and 4.1 off Holon - inside both pins'
       old 16-unit hit discs, so the old rule handed it to whichever was
       painted last. */
    const leaningToBatYam = { x: 101, y: 249.6 };
    expect(
      nearestPinWithin(pinsInPaintOrder, leaningToBatYam, mobileRadius)?.name
    ).toBe('בת ים');

    const leaningToHolon = { x: 104, y: 249.8 };
    expect(
      nearestPinWithin(pinsInPaintOrder, leaningToHolon, mobileRadius)?.name
    ).toBe('חולון');
  });

  it('selects nothing when the tap is outside the threshold', () => {
    /* Out in the Mediterranean, well clear of every pin. */
    expect(nearestPinWithin(pinsInPaintOrder, { x: -80, y: 400 }, mobileRadius))
      .toBeNull();
  });

  it('selects nothing just outside the radius and the pin just inside it', () => {
    const beerSheva = at('באר שבע');
    const justInside = { x: beerSheva.x, y: beerSheva.y - desktopRadius + 0.5 };
    const justOutside = { x: beerSheva.x, y: beerSheva.y - desktopRadius - 0.5 };
    expect(nearestPinWithin(pinsInPaintOrder, justInside, desktopRadius)?.name)
      .toBe('באר שבע');
    expect(
      nearestPinWithin(pinsInPaintOrder, justOutside, desktopRadius)
    ).toBeNull();
  });

  it('selects nothing when there are no pins', () => {
    expect(nearestPinWithin([], at('חולון'), mobileRadius)).toBeNull();
  });

  it('keeps a roughly 44px target: the radius is half of it in CSS pixels', () => {
    expect(MAP_TAP_RADIUS_PX).toBeGreaterThanOrEqual(22);
  });
});

/**
 * The browser hands the map its own screen matrix; these lock the inverse -
 * a tap in client pixels has to land on the right place in map units, and
 * the same matrix has to say how big a fingertip is in those units.
 */
describe('mapPointFromClient', () => {
  /* A 390x844 phone: the 360-unit viewBox drawn 188px wide at (101, 258),
     which is what the live section measures. `preserveAspectRatio` is
     xMidYMid meet and the box is uniform, so the matrix is a plain scale
     plus a translate. */
  const scale = 188 / 360;
  const phoneMatrix = { a: scale, b: 0, c: 0, d: scale, e: 101, f: 258 };

  /** Where a pin at (x, y) in map units shows up on that phone's screen. */
  const onScreen = (point: { x: number; y: number }) => ({
    clientX: point.x * scale + 101,
    clientY: point.y * scale + 258,
  });

  it('turns a tap on a pin back into that pin s map point', () => {
    const holon = at('חולון');
    const tap = onScreen(holon);
    const mapped = mapPointFromClient(phoneMatrix, tap.clientX, tap.clientY);
    expect(mapped).not.toBeNull();
    expect(mapped!.point.x).toBeCloseTo(holon.x, 6);
    expect(mapped!.point.y).toBeCloseTo(holon.y, 6);
  });

  it('reports the scale, so a fingertip can be measured in map units', () => {
    const mapped = mapPointFromClient(phoneMatrix, 101, 258);
    expect(mapped!.pxPerUnit).toBeCloseTo(scale, 9);
  });

  it('survives a viewBox that starts left of zero', () => {
    /* The live map's viewBox is "-20 0 360 710": map x=-20 is drawn at the
       left edge of the element. */
    const mapped = mapPointFromClient(phoneMatrix, 101 + -20 * scale, 258);
    expect(mapped!.point.x).toBeCloseTo(-20, 6);
  });

  it('gives nothing back for a matrix that cannot be inverted', () => {
    expect(mapPointFromClient({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, 5, 5))
      .toBeNull();
  });

  it('resolves a real phone tap on Bat Yam to Bat Yam, not to a later pin', () => {
    const tap = onScreen(at('בת ים'));
    const mapped = mapPointFromClient(phoneMatrix, tap.clientX, tap.clientY)!;
    const hit = nearestPinWithin(
      pinsInPaintOrder,
      mapped.point,
      MAP_TAP_RADIUS_PX / mapped.pxPerUnit
    );
    expect(hit?.name).toBe('בת ים');
  });
});
