/**
 * Env contract tests (SEC-05).
 *
 * Two independent things are pinned here, because they fail independently:
 *
 * 1. `checkRuntimeEnv()` - the decision `worker.ts` makes once per isolate.
 *    It is a pure function over a plain record precisely so it can be driven
 *    here, with no Worker, no build and no live environment. The property that
 *    matters most is negative: the result carries NAMES ONLY, so the worker can
 *    log it without ever printing a secret.
 *
 * 2. The schema in `src/lib/env.ts` names the variables this app actually
 *    reads. Wiring the previous schema would have taken production down - it
 *    hard-required four AUTH0_* variables with zero readers and two Supabase
 *    names nothing reads. A schema that drifts from the readers is worse than
 *    no schema, so the drift itself is what is asserted, against SOURCE, in the
 *    `dashboard-free-mvp.test.ts` style.
 *
 * No fixture below is a real credential; every value is an obvious placeholder.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkRuntimeEnv,
  ALWAYS_REQUIRED_SERVER_VARS,
  PRODUCTION_PAYMENT_VARS,
} from '@/lib/env';

const SRC = join(process.cwd(), 'src');

/** Strip // and block comments so prose about the change is not read as code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Every always-required variable, present. Placeholders, not credentials. */
const ALL_PRESENT: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: 'https://app.example.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.example.test',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'role-fixture',
  JWT_SECRET: 'jwt-fixture',
};

describe('checkRuntimeEnv', () => {
  it('rejects an empty environment and names every always-required variable', () => {
    const result = checkRuntimeEnv({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([...result.missing].sort()).toEqual([...ALWAYS_REQUIRED_SERVER_VARS].sort());
  });

  it('accepts an environment with all five always-required variables', () => {
    expect(checkRuntimeEnv({ ...ALL_PRESENT })).toEqual({ ok: true });
  });

  it('requires the Green Invoice credentials once GREENINVOICE_ENV is production', () => {
    const result = checkRuntimeEnv({ ...ALL_PRESENT, GREENINVOICE_ENV: 'production' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([...PRODUCTION_PAYMENT_VARS]);
  });

  it('does not require the Green Invoice credentials in sandbox', () => {
    expect(checkRuntimeEnv({ ...ALL_PRESENT, GREENINVOICE_ENV: 'sandbox' })).toEqual({
      ok: true,
    });
  });

  it('treats an empty string as absent - Workers surface unset secrets as ""', () => {
    const result = checkRuntimeEnv({ ...ALL_PRESENT, SUPABASE_SERVICE_ROLE_KEY: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('does not require SUPABASE_JWT_SECRET - it is guarded at the point of use', () => {
    expect(ALWAYS_REQUIRED_SERVER_VARS).not.toContain('SUPABASE_JWT_SECRET');
    expect(checkRuntimeEnv({ ...ALL_PRESENT })).toEqual({ ok: true });
  });

  it('names exactly the one variable that is missing, and nothing else', () => {
    for (const name of ALWAYS_REQUIRED_SERVER_VARS) {
      const source = { ...ALL_PRESENT };
      delete source[name];

      const result = checkRuntimeEnv(source);

      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.missing).toEqual([name]);
    }
  });

  it('never carries a value into its result, so the worker can log it safely', () => {
    const canary = 'do-not-leak-me';
    const result = checkRuntimeEnv({
      ...ALL_PRESENT,
      JWT_SECRET: canary,
      GREENINVOICE_ENV: 'production',
      GREENINVOICE_API_KEY_ID: canary,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(canary);
  });

  it('is pure - it does not throw on hostile input and ignores non-string values', () => {
    expect(() => checkRuntimeEnv({ JWT_SECRET: 42, NEXT_PUBLIC_APP_URL: null })).not.toThrow();

    const result = checkRuntimeEnv({ ...ALL_PRESENT, JWT_SECRET: 42 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(['JWT_SECRET']);
  });
});

describe('env schema names match the runtime readers', () => {
  const envSource = code(readFileSync(join(SRC, 'lib/env.ts'), 'utf8'));

  it('names no variable that has zero readers in this app', () => {
    for (const orphan of [
      'AUTH0_CLIENT_ID',
      'AUTH0_CLIENT_SECRET',
      'NEXT_PUBLIC_AUTH0_DOMAIN',
      'NEXT_PUBLIC_AUTH0_CLIENT_ID',
      'SUPABASE_SERVICE_KEY',
    ]) {
      expect(envSource).not.toContain(orphan);
    }
  });

  it('names the Supabase variables the runtime actually reads', () => {
    expect(envSource).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(envSource).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(envSource).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  /**
   * A fixed list, not a tree walk: deterministic, fast, and it fails loudly if
   * a reader moves - which is exactly the review moment this test exists for.
   */
  const KNOWN_READERS: Record<(typeof ALWAYS_REQUIRED_SERVER_VARS)[number], readonly string[]> = {
    NEXT_PUBLIC_APP_URL: ['app/api/auth/callback/route.ts'],
    NEXT_PUBLIC_SUPABASE_URL: ['lib/supabase/server.ts', 'lib/supabase/user-client.ts'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ['lib/supabase/user-client.ts'],
    SUPABASE_SERVICE_ROLE_KEY: ['lib/supabase/server.ts'],
    JWT_SECRET: ['services/auth/session.ts'],
  };

  it.each(ALWAYS_REQUIRED_SERVER_VARS)(
    'every always-required variable has a real reader outside lib/env.ts: %s',
    (name) => {
      const hasReader = KNOWN_READERS[name].some((relative) =>
        readFileSync(join(SRC, relative), 'utf8').includes(`process.env.${name}`)
      );

      expect(hasReader).toBe(true);
    }
  );

  it('stays dependency-free apart from zod, so worker.ts can import it pre-boot', () => {
    const imports = envSource.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual(["import { z } from 'zod';"]);
  });
});
