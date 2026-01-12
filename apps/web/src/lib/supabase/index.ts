/**
 * Supabase Exports
 *
 * Client-side: import { supabase } from '@/lib/supabase'
 * Server-side: import { supabaseAdmin } from '@/lib/supabase/server'
 */

export { supabase } from './client';
export type {
  Database,
  Tables,
  InsertTables,
  UpdateTables,
  User,
  SocialProof,
  VerificationRun,
  VerificationSchedule,
  VerificationAttempt,
  Payment,
  Entitlement,
  Vote,
  VoteOption,
  UserVote,
} from './types';
