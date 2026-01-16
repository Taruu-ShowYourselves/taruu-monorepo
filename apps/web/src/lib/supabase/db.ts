/**
 * Supabase Database Operations
 * Server-side only - uses service role key
 */

import { supabaseAdmin } from './server';
import type { TreasuryTransactionType } from '@sync/shared';
import type {
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
  PushToken,
  WebhookEvent,
  InsertTables,
  UpdateTables,
} from './types';

// ============================================
// USER OPERATIONS
// ============================================

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUserByDID(did: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('did', did)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createUser(userData: InsertTables<'users'>): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data;
}

export async function updateUser(
  userId: string,
  updates: UpdateTables<'users'>
): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update user:', error);
    return null;
  }
  return data;
}

export async function updateUserIdentityScore(
  userId: string,
  score: number
): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ identity_score: score })
    .eq('id', userId);
}

// ============================================
// SOCIAL PROOFS OPERATIONS
// ============================================

export async function getSocialProofsByUserId(userId: string): Promise<SocialProof[]> {
  const { data, error } = await supabaseAdmin
    .from('social_proofs')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get social proofs:', error);
    return [];
  }
  return data || [];
}

export async function getSocialProofByProvider(
  userId: string,
  provider: 'google' | 'facebook' | 'instagram'
): Promise<SocialProof | null> {
  const { data, error } = await supabaseAdmin
    .from('social_proofs')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createSocialProof(
  proofData: InsertTables<'social_proofs'>
): Promise<SocialProof> {
  const { data, error } = await supabaseAdmin
    .from('social_proofs')
    .insert(proofData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create social proof: ${error.message}`);
  return data;
}

export async function upsertSocialProof(
  proofData: InsertTables<'social_proofs'>
): Promise<SocialProof> {
  const { data, error } = await supabaseAdmin
    .from('social_proofs')
    .upsert(proofData, { onConflict: 'user_id,provider' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert social proof: ${error.message}`);
  return data;
}

export async function deleteSocialProof(
  userId: string,
  provider: 'google' | 'facebook' | 'instagram'
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('social_proofs')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw new Error(`Failed to delete social proof: ${error.message}`);
}

// ============================================
// VERIFICATION OPERATIONS
// ============================================

export async function getActiveVerificationRun(
  userId: string
): Promise<VerificationRun | null> {
  const { data, error } = await supabaseAdmin
    .from('verification_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data;
}

export async function getVerificationRunById(
  runId: string
): Promise<VerificationRun | null> {
  const { data, error } = await supabaseAdmin
    .from('verification_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createVerificationRun(
  runData: InsertTables<'verification_runs'>
): Promise<VerificationRun> {
  const { data, error } = await supabaseAdmin
    .from('verification_runs')
    .insert(runData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create verification run: ${error.message}`);
  return data;
}

export async function updateVerificationRun(
  runId: string,
  updates: UpdateTables<'verification_runs'>
): Promise<VerificationRun | null> {
  const { data, error } = await supabaseAdmin
    .from('verification_runs')
    .update(updates)
    .eq('id', runId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update verification run:', error);
    return null;
  }
  return data;
}

export async function getVerificationSchedule(
  runId: string
): Promise<VerificationSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from('verification_schedule')
    .select('*')
    .eq('run_id', runId)
    .order('window_start', { ascending: true });

  if (error) {
    console.error('Failed to get verification schedule:', error);
    return [];
  }
  return data || [];
}

export async function getNextPendingCheckIn(
  runId: string
): Promise<VerificationSchedule | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('verification_schedule')
    .select('*')
    .eq('run_id', runId)
    .eq('completed', false)
    .gte('window_end', now)
    .order('window_start', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createVerificationScheduleItems(
  items: InsertTables<'verification_schedule'>[]
): Promise<VerificationSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from('verification_schedule')
    .insert(items)
    .select();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);
  return data || [];
}

export async function updateVerificationScheduleItem(
  scheduleId: string,
  updates: UpdateTables<'verification_schedule'>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('verification_schedule')
    .update(updates)
    .eq('id', scheduleId);

  if (error) throw new Error(`Failed to update schedule item: ${error.message}`);
}

export async function createVerificationAttempt(
  attemptData: InsertTables<'verification_attempts'>
): Promise<VerificationAttempt> {
  const { data, error } = await supabaseAdmin
    .from('verification_attempts')
    .insert(attemptData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create attempt: ${error.message}`);
  return data;
}

export async function getUpcomingReminders(): Promise<
  Array<{
    schedule: VerificationSchedule;
    run: VerificationRun;
    user: User;
  }>
> {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

  const { data, error } = await supabaseAdmin
    .from('verification_schedule')
    .select(`
      *,
      verification_runs!inner (
        *,
        users!inner (*)
      )
    `)
    .eq('completed', false)
    .eq('reminder_sent', false)
    .lte('window_start', soon.toISOString())
    .gte('window_end', now.toISOString());

  if (error || !data) return [];

  return data.map((item: any) => ({
    schedule: item,
    run: item.verification_runs,
    user: item.verification_runs.users,
  }));
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

/**
 * Verify that a payment is completed and belongs to the user.
 * CRITICAL SECURITY: This function must be called before processing any
 * vote creation or participation to prevent free votes.
 *
 * @param paymentId - The payment ID to verify
 * @param userId - The user ID who should own the payment
 * @param expectedType - Expected payment type ('vote_creation' or 'vote_participation')
 * @returns true if payment is valid and completed, false otherwise
 */
export async function verifyPaymentCompleted(
  paymentId: string,
  userId: string,
  expectedType: 'vote_creation' | 'vote_participation'
): Promise<{ valid: boolean; error?: string }> {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    return { valid: false, error: 'Payment not found' };
  }

  if (payment.user_id !== userId) {
    return { valid: false, error: 'Payment does not belong to user' };
  }

  if (payment.status !== 'completed') {
    return { valid: false, error: `Payment not completed (status: ${payment.status})` };
  }

  if (payment.type !== expectedType) {
    return { valid: false, error: `Invalid payment type (expected: ${expectedType}, got: ${payment.type})` };
  }

  return { valid: true };
}

/**
 * Check if a payment has already been used for a vote or vote creation.
 * Prevents payment reuse attacks.
 */
export async function isPaymentAlreadyUsed(
  paymentId: string,
  forType: 'vote_creation' | 'vote_participation'
): Promise<boolean> {
  if (forType === 'vote_participation') {
    // Check if payment ID is already in user_votes
    const { data } = await supabaseAdmin
      .from('user_votes')
      .select('id')
      .eq('payment_id', paymentId)
      .single();
    return !!data;
  } else {
    // Check if there's a vote created with this payment (via entitlements)
    const { data } = await supabaseAdmin
      .from('entitlements')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('type', 'create_vote')
      .single();
    return !!data;
  }
}

export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getPaymentByProviderId(
  providerId: string
): Promise<Payment | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('provider_id', providerId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getPaymentByIdempotencyKey(
  key: string
): Promise<Payment | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('idempotency_key', key)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createPayment(
  paymentData: InsertTables<'payments'>
): Promise<Payment> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert(paymentData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create payment: ${error.message}`);
  return data;
}

export async function updatePaymentStatus(
  paymentId: string,
  status: 'pending' | 'completed' | 'failed' | 'refunded',
  providerId?: string
): Promise<Payment | null> {
  const updates: UpdateTables<'payments'> = { status };
  if (providerId) updates.provider_id = providerId;

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update payment:', error);
    return null;
  }
  return data;
}

// ============================================
// ENTITLEMENT OPERATIONS
// ============================================

export async function createEntitlement(
  entitlementData: InsertTables<'entitlements'>
): Promise<Entitlement> {
  const { data, error } = await supabaseAdmin
    .from('entitlements')
    .insert(entitlementData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create entitlement: ${error.message}`);
  return data;
}

export async function getUserEntitlements(userId: string): Promise<Entitlement[]> {
  const { data, error } = await supabaseAdmin
    .from('entitlements')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get entitlements:', error);
    return [];
  }
  return data || [];
}

export async function hasVoteEntitlement(
  userId: string,
  voteId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('vote_id', voteId)
    .eq('type', 'vote')
    .single();

  return !!data;
}

// ============================================
// VOTE OPERATIONS
// ============================================

export async function getVoteById(voteId: string): Promise<Vote | null> {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select('*')
    .eq('id', voteId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getVoteWithOptions(
  voteId: string
): Promise<(Vote & { options: VoteOption[] }) | null> {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select(`
      *,
      vote_options (*)
    `)
    .eq('id', voteId)
    .single();

  if (error || !data) return null;
  const voteOptions = (data.vote_options || []) as unknown as VoteOption[];
  return { ...data, options: voteOptions };
}

export async function getActiveVotes(
  municipalityId?: string
): Promise<Vote[]> {
  let query = supabaseAdmin
    .from('votes')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (municipalityId) {
    query = query.eq('municipality_id', municipalityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get active votes:', error);
    return [];
  }
  return data || [];
}

export async function getVotesByMunicipality(
  municipalityId: string,
  status?: 'pending' | 'active' | 'ended'
): Promise<Vote[]> {
  let query = supabaseAdmin
    .from('votes')
    .select('*')
    .eq('municipality_id', municipalityId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get votes by municipality:', error);
    return [];
  }
  return data || [];
}

export async function getActiveVotesWithOptions(
  municipalityId?: string
): Promise<(Vote & { options: VoteOption[] })[]> {
  let query = supabaseAdmin
    .from('votes')
    .select(`
      *,
      vote_options (*)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (municipalityId) {
    query = query.eq('municipality_id', municipalityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get active votes with options:', error);
    return [];
  }

  return (data || []).map((vote: any) => ({
    ...vote,
    options: vote.vote_options || [],
  }));
}

export async function createVote(
  voteData: InsertTables<'votes'>
): Promise<Vote> {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .insert(voteData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create vote: ${error.message}`);
  return data;
}

export async function createVoteOptions(
  options: InsertTables<'vote_options'>[]
): Promise<VoteOption[]> {
  const { data, error } = await supabaseAdmin
    .from('vote_options')
    .insert(options)
    .select();

  if (error) throw new Error(`Failed to create vote options: ${error.message}`);
  return data || [];
}

export async function incrementVoteOption(optionId: string): Promise<void> {
  // Use RPC function for atomic increment
  const { error } = await supabaseAdmin.rpc('increment_vote_option', {
    option_id: optionId,
  });

  if (error) {
    // Fallback to manual increment
    const { data: option } = await supabaseAdmin
      .from('vote_options')
      .select('votes')
      .eq('id', optionId)
      .single();

    if (option) {
      await supabaseAdmin
        .from('vote_options')
        .update({ votes: option.votes + 1 })
        .eq('id', optionId);
    }
  }
}

export async function recordUserVote(
  voteRecord: InsertTables<'user_votes'>
): Promise<UserVote> {
  const { data, error } = await supabaseAdmin
    .from('user_votes')
    .insert(voteRecord)
    .select()
    .single();

  if (error) throw new Error(`Failed to record vote: ${error.message}`);
  return data;
}

export async function getUserVote(
  userId: string,
  voteId: string
): Promise<UserVote | null> {
  const { data, error } = await supabaseAdmin
    .from('user_votes')
    .select('*')
    .eq('user_id', userId)
    .eq('vote_id', voteId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function hasUserParticipated(
  userId: string,
  voteId: string
): Promise<boolean> {
  const vote = await getUserVote(userId, voteId);
  return !!vote;
}

export async function getUserVotes(userId: string): Promise<UserVote[]> {
  const { data, error } = await supabaseAdmin
    .from('user_votes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get user votes:', error);
    return [];
  }
  return data || [];
}

export async function getUserVotesWithDetails(
  userId: string
): Promise<Array<UserVote & { vote: Vote; option: VoteOption | null }>> {
  const { data, error } = await supabaseAdmin
    .from('user_votes')
    .select(`
      *,
      votes (*),
      vote_options (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get user votes with details:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    vote: item.votes,
    option: item.vote_options,
  }));
}

export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get user payments:', error);
    return [];
  }
  return data || [];
}

// ============================================
// PUSH TOKEN OPERATIONS
// ============================================

export async function upsertPushToken(
  tokenData: InsertTables<'push_tokens'>
): Promise<PushToken> {
  const { data, error } = await supabaseAdmin
    .from('push_tokens')
    .upsert(tokenData, { onConflict: 'user_id,token' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert push token: ${error.message}`);
  return data;
}

export async function getPushTokensByUserId(userId: string): Promise<PushToken[]> {
  const { data, error } = await supabaseAdmin
    .from('push_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to get push tokens:', error);
    return [];
  }
  return data || [];
}

export async function getActiveUserPushTokens(userId: string): Promise<string[]> {
  const tokens = await getPushTokensByUserId(userId);
  return tokens.map((t) => t.token);
}

export async function deletePushToken(
  userId: string,
  token: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) throw new Error(`Failed to delete push token: ${error.message}`);
}

export async function deactivatePushToken(
  userId: string,
  token: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('push_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('token', token);

  if (error) throw new Error(`Failed to deactivate push token: ${error.message}`);
}

export async function updatePushTokenLastUsed(
  tokens: string[]
): Promise<void> {
  if (tokens.length === 0) return;

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .update({ last_used: new Date().toISOString() })
    .in('token', tokens);

  if (error) {
    console.error('Failed to update push token last_used:', error);
  }
}

// ============================================
// WEBHOOK EVENT OPERATIONS (Replay Attack Prevention)
// ============================================

/**
 * Check if a webhook event has already been processed.
 * Returns the existing event if found, null otherwise.
 *
 * Why this matters:
 * - Prevents replay attacks where an attacker captures a valid webhook
 *   and sends it multiple times to trigger duplicate processing
 * - HMAC signatures prove authenticity but not uniqueness
 */
export async function getWebhookEventByEventId(
  eventId: string
): Promise<WebhookEvent | null> {
  const { data, error } = await supabaseAdmin
    .from('webhook_events')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Record a new webhook event before processing.
 * This creates a pending record that blocks duplicate processing.
 */
export async function createWebhookEvent(
  eventData: InsertTables<'webhook_events'>
): Promise<WebhookEvent> {
  const { data, error } = await supabaseAdmin
    .from('webhook_events')
    .insert(eventData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create webhook event: ${error.message}`);
  return data;
}

/**
 * Update webhook event status after processing.
 */
export async function updateWebhookEventStatus(
  eventId: string,
  status: 'processed' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  const updates: UpdateTables<'webhook_events'> = {
    status,
    processed_at: status === 'processed' ? new Date().toISOString() : null,
    error_message: errorMessage || null,
  };

  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update(updates)
    .eq('event_id', eventId);

  if (error) {
    console.error('Failed to update webhook event:', error);
  }
}

/**
 * Check if a webhook is stale (older than max age).
 *
 * @param timestamp - Webhook timestamp in seconds (Unix epoch)
 * @param maxAgeSeconds - Maximum allowed age in seconds (default 5 minutes)
 * @returns true if webhook is too old and should be rejected
 */
export function isWebhookStale(
  timestamp: number,
  maxAgeSeconds: number = 5 * 60
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);
  return age > maxAgeSeconds;
}

// ============================================
// USER STATISTICS OPERATIONS
// ============================================

/**
 * Count the number of votes a user has participated in.
 */
export async function countUserVoteParticipations(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('user_votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to count user vote participations:', error);
    return 0;
  }
  return count || 0;
}

/**
 * Count the number of votes created by a user.
 */
export async function countVotesCreatedByUser(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', userId);

  if (error) {
    console.error('Failed to count votes created by user:', error);
    return 0;
  }
  return count || 0;
}

/**
 * Get votes created by a user.
 */
export async function getVotesCreatedByUser(userId: string): Promise<Vote[]> {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get votes created by user:', error);
    return [];
  }
  return data || [];
}

/**
 * Get user voting statistics summary.
 * Returns counts for votes participated in and votes created.
 */
export async function getUserVoteStats(userId: string): Promise<{
  votesParticipated: number;
  votesCreated: number;
}> {
  const [votesParticipated, votesCreated] = await Promise.all([
    countUserVoteParticipations(userId),
    countVotesCreatedByUser(userId),
  ]);

  return {
    votesParticipated,
    votesCreated,
  };
}

// === Treasury Functions ===

/**
 * Get treasury by municipality ID
 */
export async function getTreasuryByMunicipality(municipalityId: string) {
  const { data, error } = await supabaseAdmin
    .from('treasury')
    .select('*')
    .eq('municipality_id', municipalityId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get treasury:', error);
    throw error;
  }
  return data;
}

/**
 * Get treasury transactions with pagination
 */
export async function getTreasuryTransactions(
  treasuryId: string,
  options: { limit?: number; offset?: number; type?: TreasuryTransactionType } = {}
) {
  const { limit = 50, offset = 0, type } = options;

  let query = supabaseAdmin
    .from('treasury_transactions')
    .select('*')
    .eq('treasury_id', treasuryId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get treasury transactions:', error);
    throw error;
  }
  return data || [];
}

/**
 * Create or get treasury for a municipality (calls the SQL function)
 */
export async function getOrCreateTreasury(municipalityId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('get_or_create_treasury', {
    p_municipality_id: municipalityId,
  });

  if (error) {
    console.error('Failed to get or create treasury:', error);
    throw error;
  }
  return data;
}

// === Issue Coin Functions ===

/**
 * Get Issue Coin by vote ID
 */
export async function getIssueCoinByVoteId(voteId: string) {
  const { data, error } = await supabaseAdmin
    .from('issue_coins')
    .select('*')
    .eq('vote_id', voteId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get issue coin:', error);
    throw error;
  }
  return data;
}

/**
 * Get Issue Coin by token mint address
 */
export async function getIssueCoinByMint(tokenMint: string) {
  const { data, error } = await supabaseAdmin
    .from('issue_coins')
    .select('*')
    .eq('token_mint', tokenMint)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get issue coin by mint:', error);
    throw error;
  }
  return data;
}

/**
 * Create an Issue Coin for a vote
 */
export async function createIssueCoin(data: {
  voteId: string;
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  totalSupply?: string;
  launchTxHash?: string;
}) {
  const { data: issueCoin, error } = await supabaseAdmin
    .from('issue_coins')
    .insert({
      vote_id: data.voteId,
      token_mint: data.tokenMint,
      token_name: data.tokenName,
      token_symbol: data.tokenSymbol,
      token_decimals: data.tokenDecimals || 9,
      total_supply: data.totalSupply,
      launch_tx_hash: data.launchTxHash,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create issue coin:', error);
    throw error;
  }
  return issueCoin;
}

/**
 * Update Issue Coin
 */
export async function updateIssueCoin(
  issueCoinId: string,
  updates: {
    tradingEnabled?: boolean;
    isFrozen?: boolean;
    feeShareConfigured?: boolean;
    totalPurchased?: string;
    totalValueIls?: number;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (updates.tradingEnabled !== undefined) updateData.trading_enabled = updates.tradingEnabled;
  if (updates.isFrozen !== undefined) {
    updateData.is_frozen = updates.isFrozen;
    if (updates.isFrozen) updateData.frozen_at = new Date().toISOString();
  }
  if (updates.feeShareConfigured !== undefined) updateData.fee_share_configured = updates.feeShareConfigured;
  if (updates.totalPurchased !== undefined) updateData.total_purchased = updates.totalPurchased;
  if (updates.totalValueIls !== undefined) updateData.total_value_ils = updates.totalValueIls;

  const { data, error } = await supabaseAdmin
    .from('issue_coins')
    .update(updateData)
    .eq('id', issueCoinId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update issue coin:', error);
    throw error;
  }
  return data;
}

/**
 * Get Issue Coin holders
 */
export async function getIssueCoinHolders(
  issueCoinId: string,
  options: { limit?: number; offset?: number; residentsOnly?: boolean } = {}
) {
  const { limit = 100, offset = 0, residentsOnly = false } = options;

  let query = supabaseAdmin
    .from('issue_coin_holdings')
    .select('*, users(first_name, last_name, avatar_url)')
    .eq('issue_coin_id', issueCoinId)
    .order('token_amount', { ascending: false })
    .range(offset, offset + limit - 1);

  if (residentsOnly) {
    query = query.eq('is_local_resident', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get issue coin holders:', error);
    throw error;
  }
  return data || [];
}

/**
 * Get or create Issue Coin holding
 */
export async function upsertIssueCoinHolding(data: {
  issueCoinId: string;
  userId?: string;
  walletAddress?: string;
  tokenAmount: string;
  investedIls: number;
  isLocalResident?: boolean;
}) {
  const now = new Date().toISOString();
  const existingQuery = supabaseAdmin
    .from('issue_coin_holdings')
    .select('*')
    .eq('issue_coin_id', data.issueCoinId);

  if (data.userId) {
    existingQuery.eq('user_id', data.userId);
  } else if (data.walletAddress) {
    existingQuery.eq('wallet_address', data.walletAddress);
  }

  const { data: existing } = await existingQuery.single();

  if (existing) {
    // Update existing holding
    const newAmount = (BigInt(existing.token_amount) + BigInt(data.tokenAmount)).toString();
    const { data: updated, error } = await supabaseAdmin
      .from('issue_coin_holdings')
      .update({
        token_amount: newAmount,
        invested_ils: existing.invested_ils + data.investedIls,
        last_purchase_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  // Create new holding
  const { data: created, error } = await supabaseAdmin
    .from('issue_coin_holdings')
    .insert({
      issue_coin_id: data.issueCoinId,
      user_id: data.userId,
      wallet_address: data.walletAddress,
      token_amount: data.tokenAmount,
      invested_ils: data.investedIls,
      is_local_resident: data.isLocalResident || false,
      first_purchase_at: now,
      last_purchase_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert issue coin holding:', error);
    throw error;
  }
  return created;
}

/**
 * Get user's holding for a specific Issue Coin
 */
export async function getUserIssueCoinHolding(issueCoinId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('issue_coin_holdings')
    .select('*')
    .eq('issue_coin_id', issueCoinId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get user issue coin holding:', error);
    throw error;
  }
  return data;
}

/**
 * Count Issue Coin holders
 */
export async function countIssueCoinHolders(issueCoinId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('issue_coin_holdings')
    .select('*', { count: 'exact', head: true })
    .eq('issue_coin_id', issueCoinId);

  if (error) {
    console.error('Failed to count issue coin holders:', error);
    return 0;
  }
  return count || 0;
}
