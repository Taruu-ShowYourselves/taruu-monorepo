/**
 * Shared bootstrap for the desk agents (rank, docs).
 *
 * Both jobs run off-platform with local Claude Code credentials and talk to
 * the same Supabase project with the service-role key, so env loading and
 * client construction live here rather than in each entry point.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/**
 * dotenv never overwrites a key that already exists, so an empty value from
 * a copied .env.example would permanently shadow the real one in a later
 * file. Drop empties between loads.
 */
function dropEmpty(): void {
  for (const key of SUPABASE_KEYS) {
    if (process.env[key] === '') delete process.env[key];
  }
}

/**
 * Own .env first, then the web app's .dev.vars (real local credentials) and
 * .env.local. Idempotent — safe to call from every entry point.
 */
export function loadAgentEnv(): void {
  for (const path of [
    '../.env',
    '../../../apps/web/.dev.vars',
    '../../../apps/web/.env.local',
  ]) {
    loadEnv({ path: resolve(__dirname, path) });
    dropEmpty();
  }
}

/** Service-role Supabase client; exits with a clear message when unconfigured. */
export function createSupabase(): SupabaseClient {
  // NEXT_PUBLIC_ first: apps/web/.env.local historically held a placeholder
  // SUPABASE_URL.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in env, agents/knesset-ranker/.env, or apps/web/.dev.vars)'
    );
    process.exit(1);
  }
  return createClient(url, serviceKey);
}

/** True when this module path is the process entry point. */
export function isEntryPoint(moduleUrl: string): boolean {
  return Boolean(
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(moduleUrl)
  );
}

/**
 * Numeric CLI argument. `Number(x) || fallback` silently swallows 0 — which
 * made `--stale-hours 0` (rank everything now) fall back to 24 and look like
 * a no-op run.
 */
export function numberArg(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
