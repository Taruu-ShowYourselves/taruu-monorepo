/**
 * Environment Variable Validation
 * Uses Zod to validate all required environment variables at runtime.
 * Fails fast with clear error messages if any required vars are missing.
 */

import { z } from 'zod';

// === Server-side Environment Variables ===

const serverEnvSchema = z.object({
  // Supabase.
  // These are the names the runtime actually reads: lib/supabase/server.ts:22-23
  // reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, and
  // lib/supabase/user-client.ts:37-38 reads the URL + the anon key. The two
  // un-prefixed Supabase entries that used to sit here had zero readers anywhere
  // and would have rejected a correctly configured production environment.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // JWT Session
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Taruu's own EC P-256 signing key, as a private JWK (RLS transport, RLS-01).
  // DISTINCT from JWT_SECRET: JWT_SECRET signs the long-lived `sync-session`
  // cookie; this one signs the short-lived ES256 access token Supabase verifies
  // against the JWKS we publish at /.well-known/jwks.json.
  //
  // We sign our own because this Supabase project migrated to asymmetric keys:
  // its ES256 key is in_use and only the public half is ever exposed, and the
  // legacy HS256 shared secret is retired. There is no secret to borrow.
  //
  // Optional here and guarded at the point of use (lib/supabase/signing-key.ts),
  // matching the GREENINVOICE_* precedent below. An unset value must not break
  // routes that never touch the user-scoped client.
  SUPABASE_TP_PRIVATE_JWK: z
    .string()
    .min(1, 'SUPABASE_TP_PRIVATE_JWK must be a private JWK as JSON')
    .optional(),

  // Green Invoice (Merchant of Record - vote fees + merch)
  // Optional so dev/build without creds doesn't fail; the payment service guards on
  // isGreenInvoiceConfigured() and fails closed in production when the secret is unset.
  GREENINVOICE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  GREENINVOICE_API_KEY_ID: z.string().optional(),
  GREENINVOICE_API_SECRET: z.string().optional(),
  GREENINVOICE_PLUGIN_ID: z.string().optional(),
  GREENINVOICE_WEBHOOK_SECRET: z.string().optional(),

  // Resend Email.
  // Optional on purpose: one reader (services/email/index.ts:32) which already
  // falls back to '' and every send site treats email as best-effort. A missing
  // key must degrade one notification, not refuse the whole isolate.
  RESEND_API_KEY: z.string().optional(),

  // Qubik Blockchain (optional for dev)
  QUBIK_API_KEY: z.string().optional(),
  QUBIK_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),

  // Push Notifications (optional)
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // App URLs
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
});

// === Client-side Environment Variables ===

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
});

// === Type Exports ===

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

// === Validation Functions ===

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

/**
 * Validates and returns server-side environment variables.
 * Throws a detailed error if any required variables are missing or invalid.
 * Results are cached after first successful validation.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Environment validation failed:\n${errors}\n\n` +
      `Please check your .env file and ensure all required variables are set.\n` +
      `See .env.example for reference.\n`
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

/**
 * Validates and returns client-side environment variables.
 * These are safe to expose to the browser (NEXT_PUBLIC_* prefix).
 * Throws a detailed error if any required variables are missing or invalid.
 */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    const errors = result.error.errors
      .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Client environment validation failed:\n${errors}\n\n` +
      `Please check your .env file and ensure all NEXT_PUBLIC_* variables are set.\n`
    );
  }

  cachedClientEnv = result.data;
  return cachedClientEnv;
}

// === Runtime Gate (SEC-05) ===

/**
 * Variables without which NO server request path can work. Each name below has
 * at least one `process.env` reader in apps/web/src - keep this list and the
 * readers in step. `session.ts:13` and `greenInvoice/index.ts:43` capture at
 * MODULE SCOPE and silently fall back to '', which is precisely the failure
 * mode this gate exists to convert into a loud one.
 */
export const ALWAYS_REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
] as const;

/** Required only once GREENINVOICE_ENV is `production` - real money, real receipts. */
export const PRODUCTION_PAYMENT_VARS = [
  'GREENINVOICE_API_KEY_ID',
  'GREENINVOICE_API_SECRET',
  'GREENINVOICE_PLUGIN_ID',
  'GREENINVOICE_WEBHOOK_SECRET',
] as const;

/** Names only. A value NEVER appears in this result, so it is safe to log. */
export type RuntimeEnvCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly missing: readonly string[] };

/**
 * Pure runtime-environment gate.
 *
 * Deliberately NOT the Zod schema above: this runs in `worker.ts`, before the
 * Next.js bundle boots, against the Cloudflare `env` binding rather than
 * `process.env`. It answers one question - "can this isolate serve traffic at
 * all?" - and it must never throw, never allocate a Supabase client, and never
 * read a secret's value into anything it returns.
 */
export function checkRuntimeEnv(source: Record<string, unknown>): RuntimeEnvCheck {
  const present = (name: string): boolean => {
    const value = source[name];
    return typeof value === 'string' && value.length > 0;
  };

  const missing = ALWAYS_REQUIRED_SERVER_VARS.filter((name) => !present(name)) as string[];

  if (String(source.GREENINVOICE_ENV ?? '').toLowerCase() === 'production') {
    missing.push(...PRODUCTION_PAYMENT_VARS.filter((name) => !present(name)));
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/**
 * Validates all environment variables at startup.
 * Call this early in your application initialization.
 * Returns true if validation passes, throws otherwise.
 */
export function validateEnv(): boolean {
  // Only validate server env on server-side
  if (typeof window === 'undefined') {
    getServerEnv();
  }

  // Always validate client env
  getClientEnv();

  return true;
}

// === Development Helpers ===

/**
 * Checks if we're in development mode.
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if we're in production mode.
 */
export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if we're in test mode.
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}
