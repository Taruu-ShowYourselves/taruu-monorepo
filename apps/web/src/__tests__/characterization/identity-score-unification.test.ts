/**
 * PR-A pins + guard — identity_score unification.
 *
 * History: this suite began as a characterization of the PRE-unification
 * state, verified live against production on 2026-08-06 (blocker B3):
 *
 *   - SQL formula google 40 / facebook 30 / instagram 30, no GPS, trigger on
 *     social_proofs INSERT/DELETE only (20240101000002_functions.sql, byte-
 *     identical to the deployed body);
 *   - five application-side writers (facebook/instagram/auth callbacks, the
 *     profile-route createUser, and lib/supabase/db.ts updateUserIdentityScore);
 *   - the mapper dropping GPS from the displayed score.
 *
 * Those pins failed loudly when unification landed — as intended — and each
 * was replaced here by its inverse. This file now pins the POST-unification
 * contract (issue #71 final model): google 40 / operator-approved identity
 * document 40 / GPS 20 / phone 10 / facebook 10 / instagram 10 / dormant x 10,
 * max 140, with the database as the ONLY writer of users.identity_score.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

vi.mock('@/services/qubik', () => ({
  qubikService: { getTokenBalance: vi.fn(), createWallet: vi.fn() },
}));

import { transformToProfile } from '@/services/user/profile';
import type { User } from '@/lib/supabase/types';

const webRoot = join(__dirname, '..', '..', '..');
const srcRoot = join(webRoot, 'src');
const repoRoot = join(webRoot, '..', '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const src = (rel: string) => readFileSync(join(srcRoot, rel), 'utf8');

/** The last migration file that (re)defines calculate_identity_score wins. */
function latestScoreMigration(): string {
  const files = readdirSync(migrationsDir).sort();
  const defining = files.filter((f) =>
    readFileSync(join(migrationsDir, f), 'utf8').includes(
      'FUNCTION calculate_identity_score'
    )
  );
  expect(defining.length).toBeGreaterThan(0);
  return readFileSync(join(migrationsDir, defining[defining.length - 1]), 'utf8');
}

describe('pin: canonical SQL scoring (issue #71 final model)', () => {
  it('formula is google 40 / fb 10 / ig 10 / x 10 (dormant) / GPS 20 / phone 10 / document 40, capped at 140', () => {
    const sql = latestScoreMigration();
    expect(sql).toMatch(/WHEN 'google' THEN 40/);
    expect(sql).toMatch(/WHEN 'facebook' THEN 10/);
    expect(sql).toMatch(/WHEN 'instagram' THEN 10/);
    expect(sql).toMatch(/WHEN 'x' THEN 10/);
    expect(sql).toMatch(/verification_status = 'verified' THEN 20/);
    expect(sql).toMatch(/phone_verified IS TRUE THEN 10/);
    expect(sql).toMatch(/identity_verified_at IS NOT NULL THEN 40/);
    expect(sql).toMatch(/140\s*\n?\s*\)/);
    expect(sql).toMatch(/CHECK \(identity_score >= 0 AND identity_score <= 140\)/);
  });

  it('recalculates on social_proofs INSERT, UPDATE and DELETE', () => {
    const sql = latestScoreMigration();
    expect(sql).toMatch(
      /trigger_update_identity_score\s+AFTER INSERT OR UPDATE OR DELETE ON social_proofs/
    );
  });

  it('scores users rows on INSERT and on every evidence-column UPDATE (O-1)', () => {
    const sql = latestScoreMigration();
    expect(sql).toMatch(
      /trigger_identity_score_on_verification\s+BEFORE INSERT OR UPDATE OF verification_status, phone_verified, identity_verified_at/
    );
    expect(sql).toMatch(/sync_identity_score_on_users_change/);
    expect(sql).toMatch(/NEW\.identity_score := calculate_identity_score\(NEW\)/);
  });

  it('rollback is documented in the load-bearing order: recompute BEFORE re-narrowing to 0..100 (O-2)', () => {
    const sql = latestScoreMigration();
    const recompute = sql.indexOf('UPDATE users SET identity_score = calculate_identity_score(id)');
    const narrow = sql.indexOf('identity_score <= 100');
    expect(recompute).toBeGreaterThan(-1);
    expect(narrow).toBeGreaterThan(-1);
    expect(recompute).toBeLessThan(narrow);
  });

  it('keeps the production hard stop on users crossing below the 40-point voting minimum', () => {
    const sql = latestScoreMigration();
    expect(sql).toMatch(/identity_score >= 40[\s\S]*?< 40/);
    expect(sql).toMatch(/RAISE EXCEPTION/);
  });

  it('every SECURITY DEFINER function pins search_path and application roles lose direct EXECUTE', () => {
    const sql = latestScoreMigration();
    // Only executable lines count - the rollback bodies in the header comment
    // deliberately restore the historical (unpinned) definitions.
    const live = sql
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n');
    const pinned = live.match(/SECURITY DEFINER SET search_path = public/g) ?? [];
    expect(pinned.length).toBe(4);
    expect(live).not.toMatch(/SECURITY DEFINER\s*;/);
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION calculate_identity_score\(users\) FROM PUBLIC, anon, authenticated/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION calculate_identity_score\(UUID\) FROM PUBLIC, anon, authenticated/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION update_user_identity_score\(\) FROM PUBLIC, anon, authenticated/
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION sync_identity_score_on_users_change\(\) FROM PUBLIC, anon, authenticated/
    );
  });
});

describe('guard: client OCR submission cannot touch users.identity_verified_at', () => {
  it('submit-document never references the identity_verified_at writer', () => {
    const source = src('server/app/identity/submit-document.ts');
    expect(source).not.toContain('setUserIdentityVerifiedAt');
    expect(source).not.toContain('identity_verified_at:');
  });
});

describe('guard: the database is the only identity_score writer', () => {
  /** Every source file under dir (ts/tsx/js/mjs), tests excluded. */
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        out.push(...sourceFiles(full));
      } else if (/\.(tsx?|mjs|js)$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it('no application source uses identity_score as a payload key', () => {
    // `identity_score:` as an object key is how every removed writer smuggled
    // the score into an insert/update/createUser payload. The only legitimate
    // occurrences are the generated/declared DB types.
    const allowed = new Set(['lib/supabase/types.ts']);
    const offenders = sourceFiles(srcRoot)
      .filter((f) => !allowed.has(relative(srcRoot, f)))
      .filter((f) => /identity_score\s*:/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(srcRoot, f));
    expect(offenders).toEqual([]);
  });

  it('no operational script uses identity_score as a payload key', () => {
    // Seed/maintenance scripts hit the REST API with service credentials, so
    // they are writers too (a merge-duplicates upsert would clobber the
    // recomputed score on re-run).
    const scriptsDir = join(webRoot, 'scripts');
    const offenders = sourceFiles(scriptsDir)
      .filter((f) => /identity_score\s*:/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(webRoot, f));
    expect(offenders).toEqual([]);
  });

  it('updateUserIdentityScore no longer exists anywhere', () => {
    const offenders = sourceFiles(srcRoot)
      .filter((f) => readFileSync(f, 'utf8').includes('updateUserIdentityScore'))
      .map((f) => relative(srcRoot, f));
    expect(offenders).toEqual([]);
  });

  it.each([
    ['app/api/social/callback/facebook/route.ts'],
    ['app/api/social/callback/instagram/route.ts'],
    ['app/api/auth/callback/route.ts'],
    ['app/api/user/profile/route.ts'],
  ])('%s does not import the score calculator to write scores', (rel) => {
    expect(src(rel)).not.toMatch(/identity_score\s*:/);
  });
});

describe('pin: mapper feeds GPS verification into the displayed score', () => {
  const baseUser = {
    id: 'u1',
    email: 't@example.com',
    first_name: 'T',
    last_name: 'U',
    phone: null,
    municipality_id: null,
    city: null,
    notification_settings: null,
    did: null,
    did_public_key: null,
    did_encrypted_private_key: null,
    google_id: 'g1',
    avatar_url: null,
    identity_score: 40,
    verification_status: 'none',
    qubik_wallet_address: null,
    municipality_rating: null,
    municipality_rated_at: null,
    phone_verified: false,
    phone_verified_at: null,
    identity_verified_at: null,
    is_platform_admin: false,
    session_version: 1,
    security_score: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as User;
  const googleProof = {
    id: 'p1',
    user_id: 'u1',
    provider: 'google',
    provider_id: 'g1',
    provider_name: 'T U',
    provider_email: 't@example.com',
    provider_avatar: null,
    connected_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('a GPS-verified user with only a Google proof displays gps: 20, total 60 (basic)', () => {
    const user = {
      ...baseUser,
      identity_score: 60,
      verification_status: 'verified',
    } as User;
    const profile = transformToProfile(user, [googleProof] as never, 0);
    expect(profile.verificationStatus).toEqual({ phase: 'completed' });
    expect(profile.identityScore.breakdown.gps).toBe(20);
    expect(profile.identityScore.total).toBe(60);
    expect(profile.identityScore.level).toBe('basic');
  });

  it('phone and operator-approved document evidence reach the displayed score', () => {
    const user = {
      ...baseUser,
      identity_score: 110,
      verification_status: 'verified',
      phone_verified: true,
      identity_verified_at: '2026-08-01T00:00:00Z',
    } as User;
    const profile = transformToProfile(user, [googleProof] as never, 0);
    expect(profile.identityScore.breakdown.phone).toBe(10);
    expect(profile.identityScore.breakdown.idDocument).toBe(40);
    expect(profile.identityScore.total).toBe(110); // 40 google + 20 gps + 10 phone + 40 doc
    expect(profile.identityScore.level).toBe('verified');
  });

  it('a NULL phone_verified contributes no phone points', () => {
    const user = { ...baseUser, phone_verified: null } as User;
    const profile = transformToProfile(user, [googleProof] as never, 0);
    expect(profile.identityScore.breakdown.phone).toBe(0);
    expect(profile.identityScore.total).toBe(40);
  });

  it.each([
    ['none', 'not_started'],
    ['pending', 'in_progress'],
    ['failed', 'failed'],
  ] as const)(
    'verification_status %s contributes no GPS points',
    (status, phase) => {
      const user = { ...baseUser, verification_status: status } as User;
      const profile = transformToProfile(user, [googleProof] as never, 0);
      expect(profile.verificationStatus).toEqual({ phase });
      expect(profile.identityScore.breakdown.gps).toBe(0);
      expect(profile.identityScore.total).toBe(40);
    }
  );
});
