/**
 * Supabase Database Operations
 * Server-side only - uses service role key
 */

import { supabaseAdmin } from './server';
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
