import { describe, expect, it } from 'vitest';
import { MUNICIPALITY_GEO } from '@sync/shared';
import {
  interleaveByCity,
  pointForMunicipality,
  projectLatLng,
} from '@/components/press/CinematicIntro/israel-map';

/**
 * The live map is only honest if a pin lands where the town is. These lock
 * the projection to the drawing: every municipality inside the outline's
 * box, and the north/south/east/west relationships that are checkable
 * facts about the country.
 */
describe('israel map projection', () => {
  it('keeps every municipality inside the drawn outline box', () => {
    for (const muni of MUNICIPALITY_GEO) {
      const point = pointForMunicipality(muni.name);
      expect(point, muni.name).not.toBeNull();
      expect(point!.x, `${muni.name} x`).toBeGreaterThan(40);
      expect(point!.x, `${muni.name} x`).toBeLessThan(245);
      expect(point!.y, `${muni.name} y`).toBeGreaterThan(18);
      expect(point!.y, `${muni.name} y`).toBeLessThan(692);
    }
  });

  it('orders towns north to south', () => {
    const y = (name: string) => pointForMunicipality(name)!.y;
    expect(y('חיפה')).toBeLessThan(y('נתניה'));
    expect(y('נתניה')).toBeLessThan(y('תל אביב-יפו'));
    expect(y('תל אביב-יפו')).toBeLessThan(y('אשדוד'));
    expect(y('אשדוד')).toBeLessThan(y('באר שבע'));
  });

  it('orders towns west to east', () => {
    const x = (name: string) => pointForMunicipality(name)!.x;
    expect(x('בת ים')).toBeLessThan(x('רמת גן'));
    expect(x('רמת גן')).toBeLessThan(x('מודיעין-מכבים-רעות'));
    expect(x('מודיעין-מכבים-רעות')).toBeLessThan(x('ירושלים'));
  });

  it('resolves aliases and free-text town names', () => {
    expect(pointForMunicipality('תל אביב')).toEqual(
      pointForMunicipality('תל אביב-יפו')
    );
    expect(pointForMunicipality('ראשל"צ')).toEqual(
      pointForMunicipality('ראשון לציון')
    );
  });

  it('leaves unplaceable scopes off the map', () => {
    expect(pointForMunicipality('כנסת ישראל')).toBeNull();
    expect(pointForMunicipality('')).toBeNull();
  });

  it('projects the geographic corners onto the outline box corners', () => {
    expect(projectLatLng(33.34, 34.27)).toEqual({ x: 40, y: 18 });
    const southEast = projectLatLng(29.49, 35.9);
    expect(southEast.x).toBeCloseTo(245, 6);
    expect(southEast.y).toBeCloseTo(692, 6);
  });
});

/**
 * Placement is round-robin by city: the regression it guards against is one
 * loud city holding enough hot topics to fill the whole placement window
 * and starve every other municipality's pin off the map.
 */
describe('interleaveByCity', () => {
  const topic = (municipality: string, id: number) => ({ municipality, id });

  it('surfaces every placeable city before any city repeats', () => {
    // Heat-sorted input: one city dominates the top of the ranking.
    const signals = [
      ...Array.from({ length: 30 }, (_, i) => topic('בת ים', i)),
      topic('רעננה', 100),
      topic('חיפה', 101),
      topic('רחובות', 102),
      topic('חולון', 103),
    ];
    const placed = interleaveByCity(signals, 24);
    const cities = placed.map(({ signal }) => signal.municipality);
    expect(new Set(cities.slice(0, 5))).toEqual(
      new Set(['בת ים', 'רעננה', 'חיפה', 'רחובות', 'חולון'])
    );
    expect(placed).toHaveLength(24);
  });

  it('keeps each city in incoming (heat) order and ranks cities by their hottest topic', () => {
    const signals = [
      topic('בת ים', 0),
      topic('בת ים', 1),
      topic('רעננה', 2),
      topic('בת ים', 3),
      topic('רעננה', 4),
    ];
    const placed = interleaveByCity(signals, 24);
    expect(placed.map(({ signal }) => signal.id)).toEqual([0, 2, 1, 4, 3]);
  });

  it('drops unplaceable scopes and honours the cap', () => {
    const signals = [
      topic('כנסת ישראל', 0),
      topic('', 1),
      topic('בת ים', 2),
      topic('רעננה', 3),
      topic('בת ים', 4),
    ];
    expect(
      interleaveByCity(signals, 2).map(({ signal }) => signal.id)
    ).toEqual([2, 3]);
    expect(interleaveByCity([], 24)).toEqual([]);
  });

  it('attaches the same point the projection resolves for the city', () => {
    const [placed] = interleaveByCity([topic('בת ים', 0)], 24);
    expect(placed.point).toEqual(pointForMunicipality('בת ים'));
  });
});
