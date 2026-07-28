/**
 * Environment Variable Validation
 * Uses Zod to validate all required environment variables at runtime.
 * Fails fast with clear error messages if any required vars are missing.
 */

import { z } from 'zod';

// === Server-side Environment Variables ===

const serverEnvSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),

  // JWT Session
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Auth0 (primary login — OIDC Universal Login; federates Google)
  AUTH0_CLIENT_ID: z.string().min(1, 'AUTH0_CLIENT_ID is required'),
  AUTH0_CLIENT_SECRET: z.string().min(1, 'AUTH0_CLIENT_SECRET is required'),
  NEXT_PUBLIC_AUTH0_DOMAIN: z.string().min(1, 'NEXT_PUBLIC_AUTH0_DOMAIN is required'),
  NEXT_PUBLIC_AUTH0_CLIENT_ID: z.string().min(1, 'NEXT_PUBLIC_AUTH0_CLIENT_ID is required'),

  // Green Invoice (Merchant of Record — vote fees + merch)
  // Optional so dev/build without creds doesn't fail; the payment service guards on
  // isGreenInvoiceConfigured() and fails closed in production when the secret is unset.
  GREENINVOICE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  GREENINVOICE_API_KEY_ID: z.string().optional(),
  GREENINVOICE_API_SECRET: z.string().optional(),
  GREENINVOICE_PLUGIN_ID: z.string().optional(),
  GREENINVOICE_WEBHOOK_SECRET: z.string().optional(),

  // Resend Email
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

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
  // Auth0 public config (used client-side to build the /authorize URL)
  NEXT_PUBLIC_AUTH0_DOMAIN: z.string().min(1, 'NEXT_PUBLIC_AUTH0_DOMAIN is required'),
  NEXT_PUBLIC_AUTH0_CLIENT_ID: z.string().min(1, 'NEXT_PUBLIC_AUTH0_CLIENT_ID is required'),
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
    NEXT_PUBLIC_AUTH0_DOMAIN: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
    NEXT_PUBLIC_AUTH0_CLIENT_ID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
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
