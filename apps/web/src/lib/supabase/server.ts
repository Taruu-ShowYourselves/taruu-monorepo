/**
 * Supabase Admin Client for Server-Side (API Routes)
 *
 * EXPLICITLY PRIVILEGED: the service-role key bypasses Row Level Security. For RLS-enforced access use createUserScopedClient() from ./user-client.
 *
 * NEVER use this in client-side code
 *
 * Environment validation and client creation are lazy: `next build` imports
 * API route modules while collecting page data, before runtime secrets exist
 * (on Cloudflare, SUPABASE_SERVICE_ROLE_KEY lives on the Worker, not in CI).
 * Importing this module must therefore never throw; the first actual use of
 * the client validates the environment instead.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let adminClient: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

/**
 * Supabase admin client with service role key
 * Bypasses Row Level Security - use only in API routes
 *
 * A lazy proxy over the real client: the underlying client is created on
 * first property access, so importing this module without the service-role
 * key is safe while any runtime use without it still fails loudly.
 */
export const supabaseAdmin: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, _receiver) {
      const client = getSupabaseAdmin();
      const value = Reflect.get(client, prop, client);
      return typeof value === 'function' ? value.bind(client) : value;
    },
    has(_target, prop) {
      return Reflect.has(getSupabaseAdmin(), prop);
    },
  }
);

// `withUserContext()` was removed in Phase 5 (RLS-03). It called
// `set_claim('user_id', …)`, which wrote `app.user_id` while `public.user_id()`
// read `app.current_user_id`, had zero call sites, and could not have worked
// regardless: `set_config(…, true)` is transaction-local and PostgREST is
// stateless HTTP. The working transport is ./user-client.ts.
