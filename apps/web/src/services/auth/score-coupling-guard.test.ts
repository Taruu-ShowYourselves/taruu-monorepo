/**
 * Eligibility-coupling guard (canonical §10.4, engineering model §0
 * invariant 6, §6.2).
 *
 * MFA must never increase voting eligibility: the ballot gate is
 * identity_score + explicit residency, and no eligibility or participation
 * code path may so much as mention the security or trust scores. Like the
 * mint-path guard, this reads the source tree from disk so the property
 * fails loudly the moment someone wires the coupling in.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Eligibility and participation surfaces (canonical §10.4's grep targets). */
const GUARDED_PATHS = [
  'services/verification/eligibility.ts',
  'app/api/votes',
  'app/api/payments',
];

const FORBIDDEN = /security_score|securityScore|displayed_trust|displayedTrust/;

function* walk(target: string): Generator<string> {
  if (statSync(target).isFile()) {
    yield target;
    return;
  }
  for (const entry of readdirSync(target)) {
    const full = path.join(target, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

describe('score coupling containment', () => {
  it('no eligibility or participation module mentions security/trust scores', () => {
    const violations: string[] = [];

    for (const guarded of GUARDED_PATHS) {
      const absolute = path.join(SRC_ROOT, guarded);
      // A guarded path must exist - a rename would otherwise silently
      // un-guard the surface.
      expect(existsSync(absolute), `guarded path missing: ${guarded}`).toBe(true);

      for (const file of walk(absolute)) {
        if (FORBIDDEN.test(readFileSync(file, 'utf8'))) {
          violations.push(path.relative(SRC_ROOT, file));
        }
      }
    }

    expect(
      violations,
      `security/trust score referenced in an eligibility surface: ${violations.join(', ')}`
    ).toEqual([]);
  });

  it('sanity: the pattern actually matches what it guards against', () => {
    expect(FORBIDDEN.test('const x = user.security_score;')).toBe(true);
    expect(FORBIDDEN.test('getDisplayedTrustScore(displayedTrust)')).toBe(true);
    expect(FORBIDDEN.test('identity_score >= MINIMUM')).toBe(false);
  });
});
