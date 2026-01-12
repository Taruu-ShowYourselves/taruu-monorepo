/**
 * Supabase Admin Client for Server-Side (API Routes)
 * Uses service role key - bypasses RLS policies
 * NEVER use this in client-side code
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/**
 * Supabase admin client with service role key
 * Bypasses Row Level Security - use only in API routes
 */
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Helper to set the user context for RLS policies
 * Call this if you want RLS to apply even with service role
 */
export async function withUserContext(userId: string) {
  await supabaseAdmin.rpc('set_claim', { claim: 'user_id', value: userId });
}
