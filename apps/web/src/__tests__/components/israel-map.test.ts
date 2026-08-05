import { describe, expect, it } from 'vitest';
import { MUNICIPALITY_GEO } from '@sync/shared';
import {
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
