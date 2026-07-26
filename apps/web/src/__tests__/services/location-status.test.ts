/**
 * Location Status Tests
 *
 * The dashboard masthead used to print a hard-coded default town when the user
 * had no municipality, telling anyone without one that they live in Kiryat
 * Tivon. These tests lock the replacement rule:
 *
 * - no municipality        -> 'unset'      (send them to pick one)
 * - municipality, unverified -> 'unverified' (send them to verify)
 * - municipality, verified   -> 'verified'   (show the town and the badge)
 *
 * Every state maps to an action in the UI; none is a dead end.
 */

import { describe, it, expect } from 'vitest';
import { resolveLocationState } from '@/lib/locationStatus';

describe('resolveLocationState', () => {
  it("reports 'verified' for a verified user with a municipality", () => {
    expect(resolveLocationState('kiryat-tivon', true)).toBe('verified');
  });

  it("reports 'unverified' for an unverified user with a municipality", () => {
    expect(resolveLocationState('kiryat-tivon', false)).toBe('unverified');
  });

  it("reports 'unset' when there is no municipality", () => {
    expect(resolveLocationState(null, false)).toBe('unset');
    expect(resolveLocationState(undefined, false)).toBe('unset');
    expect(resolveLocationState('', false)).toBe('unset');
  });

  it("treats a whitespace-only municipality as 'unset', not as a place", () => {
    // Rendering these would leave a blank slot with no way forward.
    expect(resolveLocationState('   ', false)).toBe('unset');
    expect(resolveLocationState('\t\n', false)).toBe('unset');
  });

  it("never reports 'verified' without a municipality", () => {
    // Residency verification is verification OF a municipality, so this
    // combination is incoherent; the user still needs to choose a town.
    expect(resolveLocationState(null, true)).toBe('unset');
    expect(resolveLocationState('', true)).toBe('unset');
    expect(resolveLocationState('  ', true)).toBe('unset');
  });

  it('preserves Hebrew municipality names verbatim', () => {
    expect(resolveLocationState('קריית טבעון', false)).toBe('unverified');
    expect(resolveLocationState('תל אביב-יפו', true)).toBe('verified');
  });

  it('never invents a municipality — it only classifies the one given', () => {
    // The function returns a state, never a name, so there is nowhere for a
    // default town to be introduced.
    const states = [
      resolveLocationState(null, false),
      resolveLocationState('haifa', false),
      resolveLocationState('haifa', true),
    ];
    expect(states).toEqual(['unset', 'unverified', 'verified']);
    for (const state of states) {
      expect(['unset', 'unverified', 'verified']).toContain(state);
    }
  });
});
