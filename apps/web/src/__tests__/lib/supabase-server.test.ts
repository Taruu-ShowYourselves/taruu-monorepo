/**
 * Tests for the lazy Supabase admin client (src/lib/supabase/server.ts).
 *
 * `next build` imports API route modules while collecting page data, in an
 * environment that deliberately has no SUPABASE_SERVICE_ROLE_KEY (runtime
 * secrets live on the Cloudflare Worker). These tests pin the contract that
 * makes that safe: importing never throws, first runtime use validates the
 * environment, and valid env produces a working client exactly once.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@supabase/supabase-js')>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('lib/supabase/server lazy initialization', () => {
  it('importing without SUPABASE_SERVICE_ROLE_KEY (or URL) does not throw', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const mod = await import('@/lib/supabase/server');
    const { createClient } = await import('@supabase/supabase-js');

    expect(mod.supabaseAdmin).toBeDefined();
    // RLS-03: the dead `set_claim` transport was deleted in Phase 5.
    expect('withUserContext' in mod).toBe(false);
    // No client construction happens at import time.
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('runtime use without SUPABASE_SERVICE_ROLE_KEY fails clearly', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { supabaseAdmin } = await import('@/lib/supabase/server');

    expect(() => supabaseAdmin.from('users')).toThrow(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable'
    );
  });

  it('runtime use without NEXT_PUBLIC_SUPABASE_URL fails clearly', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const { supabaseAdmin } = await import('@/lib/supabase/server');

    expect(() => supabaseAdmin.from('users')).toThrow(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable'
    );
  });

  it('with valid env values the admin client is created correctly and reused', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const { createClient } = await import('@supabase/supabase-js');

    const query = supabaseAdmin.from('users');
    expect(query).toBeDefined();
    expect(typeof supabaseAdmin.rpc).toBe('function');

    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createClient)).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'test-service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Subsequent accesses reuse the same client - no re-creation.
    supabaseAdmin.from('votes');
    supabaseAdmin.rpc;
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
  });
});
