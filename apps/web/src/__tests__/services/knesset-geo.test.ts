/**
 * National-scope GPS verification tests
 *
 * Knesset day-order votes carry municipality_id = KNESSET_SCOPE, which has no
 * municipal polygon — verifyCheckIn must accept any location inside Israel
 * for them, and keep rejecting unknown municipalities otherwise.
 */

import { describe, it, expect } from 'vitest';
import { KNESSET_SCOPE } from '@sync/shared';
import {
  verifyCheckIn,
  isWithinIsrael,
} from '@/services/verification/municipality';

// Tel Aviv city center / Eilat / Paris
const TEL_AVIV = { lat: 32.0853, lng: 34.7818 };
const EILAT = { lat: 29.5577, lng: 34.9519 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

describe('isWithinIsrael', () => {
  it('accepts locations across the country', () => {
    expect(isWithinIsrael(TEL_AVIV.lat, TEL_AVIV.lng)).toBe(true);
    expect(isWithinIsrael(EILAT.lat, EILAT.lng)).toBe(true);
  });

  it('rejects locations abroad', () => {
    expect(isWithinIsrael(PARIS.lat, PARIS.lng)).toBe(false);
  });
});

describe('verifyCheckIn with KNESSET_SCOPE', () => {
  it('verifies any in-Israel location for a national vote', () => {
    const result = verifyCheckIn(EILAT.lat, EILAT.lng, 30, KNESSET_SCOPE);
    expect(result.verified).toBe(true);
    expect(result.inMunicipality).toBe(true);
  });

  it('rejects out-of-country locations for a national vote', () => {
    const result = verifyCheckIn(PARIS.lat, PARIS.lng, 30, KNESSET_SCOPE);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Location is outside Israel');
  });

  it('still enforces the GPS accuracy gate', () => {
    const result = verifyCheckIn(TEL_AVIV.lat, TEL_AVIV.lng, 500, KNESSET_SCOPE);
    expect(result.verified).toBe(false);
    expect(result.accuracyAcceptable).toBe(false);
  });

  it('keeps rejecting unknown municipality ids', () => {
    const result = verifyCheckIn(TEL_AVIV.lat, TEL_AVIV.lng, 30, 'עיר לא קיימת');
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Unknown municipality');
  });
});
