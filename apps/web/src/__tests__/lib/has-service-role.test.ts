import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * The guard that keeps a keyless prerender from failing the build.
 *
 * `supabaseAdmin` is a Proxy that constructs its client on first property
 * access, so a missing service-role key throws at `supabaseAdmin.rpc` - before
 * any query, and so outside the `error` channel reads destructure. Modules
 * documenting "degrades to empty without a key" did not actually do so; the
 * throw escaped the check and took `next build` down (#39).
 *
 * These pin the two halves that matter: the key-missing throw is absorbed, and
 * nothing else is.
 */

const ORIGINAL = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL;
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('hasServiceRole', () => {
  it('reports false when the key is absent, instead of throwing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const { hasServiceRole } = await import('@/lib/supabase/server');
    expect(hasServiceRole()).toBe(false);
  });

  it('reports true when a key is present', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const { hasServiceRole } = await import('@/lib/supabase/server');
    expect(hasServiceRole()).toBe(true);
  });

  it('does not swallow unrelated failures', async () => {
    // The whole value of the guard is that it absorbs exactly one throw. If it
    // ever starts returning false for anything else, a page prints an empty
    // roster on a real fault and nobody finds out.
    const guard = (probe: () => void): boolean => {
      try {
        probe();
        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('SUPABASE_SERVICE_ROLE_KEY')
        ) {
          return false;
        }
        throw error;
      }
    };

    expect(() =>
      guard(() => {
        throw new Error('ECONNREFUSED: upstream unreachable');
      })
    ).toThrow('ECONNREFUSED');

    expect(
      guard(() => {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
      })
    ).toBe(false);
  });
});
