/**
 * Single-mint-path guard (canonical §6.4c, specs/mfa-engineering-model.md §0
 * invariant 2).
 *
 * The only legitimate way to obtain a session or refresh token is through the
 * mint functions in `services/auth/session.ts`, which stamp `sv`/`amr`/`asr`
 * and are assurance-checked at their call sites. A second, unchecked mint path
 * added later (threat T-M1-10) would bypass every MFA guarantee - so this test
 * reads the source tree from disk (not by importing modules) and fails if any
 * file outside `services/auth/` imports the signing primitives.
 *
 * Allowed: files inside services/auth/ (the kernel itself) and test files.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// apps/web/src, resolved from this file's location so the test is
// working-directory independent.
const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUTH_DIR = path.join(SRC_ROOT, 'services', 'auth');

/** Import specifiers that reach the raw signing/key primitives. */
const FORBIDDEN_SPECIFIERS = [
  /from\s+['"]@\/services\/auth\/tokens['"]/,
  /from\s+['"]@\/services\/auth\/keys['"]/,
  /import\(\s*['"]@\/services\/auth\/tokens['"]\s*\)/,
  /import\(\s*['"]@\/services\/auth\/keys['"]\s*\)/,
  // Relative escapes (e.g. ../services/auth/tokens) from anywhere in src.
  /from\s+['"][.\/]*\.\.\/[^'"]*services\/auth\/(tokens|keys)['"]/,
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

describe('token signing primitive containment', () => {
  it('no module outside services/auth/ imports tokens.ts or keys.ts', () => {
    const violations: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      if (file.startsWith(AUTH_DIR + path.sep)) continue; // the kernel itself
      if (/\.test\.(ts|tsx)$/.test(file)) continue; // tests may inspect freely

      const source = readFileSync(file, 'utf8');
      if (FORBIDDEN_SPECIFIERS.some((re) => re.test(source))) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations, `signing primitive imported outside services/auth/: ${violations.join(', ')}`).toEqual([]);
  });

  it('sanity: the guard actually detects the kernel using the primitive', () => {
    // If session.ts ever stops importing tokens.ts, the FORBIDDEN_SPECIFIERS
    // patterns have probably rotted and this whole guard is asserting nothing.
    const sessionSource = readFileSync(path.join(AUTH_DIR, 'session.ts'), 'utf8');
    expect(sessionSource).toMatch(/from\s+['"]\.\/tokens['"]/);
  });

  it('the auth barrel never re-exports the signing primitives', () => {
    // A `export * from './tokens'` (or a named re-export) in index.ts would
    // hand the primitive to every importer of @/services/auth and defeat the
    // file-level guard wholesale. Forbid re-exporting tokens/keys from the
    // barrel entirely.
    const barrel = readFileSync(path.join(AUTH_DIR, 'index.ts'), 'utf8');
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+['"]\.\/(tokens|keys)['"]/);
    expect(barrel).not.toMatch(/export\s+\{[^}]*\}\s+from\s+['"]\.\/(tokens|keys)['"]/);
  });
});
