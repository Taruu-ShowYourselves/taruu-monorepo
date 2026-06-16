/**
 * Supabase Database Operations
 * Server-side only - uses service role key
 */

import { supabaseAdmin } from './server';
import type { TreasuryTransactionType } from '@sync/shared';
import type {
  Json,
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
  VoteNft,
  MerchOrderRow,
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

/**
 * Get users of a municipality for notifications (id, email, first name).
 * Capped to protect the request path — broadcast batches stay bounded.
 */
export async function getUsersByMunicipality(
  municipalityId: string,
  options: { limit?: number } = {}
): Promise<Array<{ id: string; email: string; first_name: string | null }>> {
  const { limit = 500 } = options;
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name')
    .eq('municipality_id', municipalityId)
    .not('email', 'is', null)
    .limit(limit);

  if (error) {
    console.error('Failed to get municipality users:', error);
    return [];
  }
  return data || [];
}

/**
 * Get a vote's participants with their contact details and chosen option.
 * Used for the post-resolution results email.
 */
export async function getVoteParticipantsWithEmails(
  voteId: string
): Promise<
  Array<{
    user_id: string;
    option_id: string;
    email: string;
    first_name: string | null;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from('user_votes')
    .select('user_id, option_id, users(email, first_name)')
    .eq('vote_id', voteId);

  if (error) {
    console.error('Failed to get vote participants:', error);
    return [];
  }

  return (data || [])
    .map((row) => {
      const user = row.users as unknown as { email: string; first_name: string | null } | null;
      if (!user?.email) return null;
      return {
        user_id: row.user_id,
        option_id: row.option_id,
        email: user.email,
        first_name: user.first_name,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
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

/**
 * The user's most recent completed payment that hasn't already had a refund
 * requested. Used when the refund form doesn't specify a payment id.
 */
export async function getLatestRefundablePayment(
  userId: string
): Promise<Payment | null> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) return null;
  const row = data.find(
    (p) => (p.metadata as { refund?: { status?: string } } | null)?.refund?.status !== 'requested'
  );
  return row ?? null;
}

/** Outcome of recording a refund request — drives the route's HTTP mapping. */
export type RefundRequestResult =
  | 'ok'
  | 'not_found' // missing, or not owned by this user
  | 'not_refundable' // not a completed payment
  | 'already_requested'
  | 'error';

/**
 * Record a user's refund request on the payment's metadata. Ownership +
 * `completed` status are enforced here so the route can't request a refund on
 * someone else's or an unsettled payment. Refunds are issued manually in Paddle
 * (per policy) — this only captures the intake, it does not move money.
 */
export async function requestPaymentRefund(
  paymentId: string,
  userId: string,
  reason: string
): Promise<RefundRequestResult> {
  const { data: row, error: selErr } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, status, metadata')
    .eq('id', paymentId)
    .maybeSingle();

  if (selErr) {
    console.error('Refund request: payment lookup failed:', selErr);
    return 'error';
  }
  if (!row || row.user_id !== userId) return 'not_found';
  if (row.status !== 'completed') return 'not_refundable';

  const metadata = (row.metadata as Record<string, unknown>) || {};
  const existing = metadata.refund as { status?: string } | undefined;
  if (existing?.status === 'requested') return 'already_requested';

  const { error: updErr } = await supabaseAdmin
    .from('payments')
    .update({
      metadata: {
        ...metadata,
        refund: { reason, status: 'requested', requestedAt: new Date().toISOString() },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updErr) {
    console.error('Refund request: metadata update failed:', updErr);
    return 'error';
  }
  return 'ok';
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

/**
 * Accrue an ILS deposit into a municipality treasury ledger.
 * Wraps the record_treasury_deposit SQL function (atomic balance update + audit row).
 * For vote participation, pass voteId so the amount feeds that vote's bag at resolution.
 */
export async function recordTreasuryDeposit(params: {
  municipalityId: string;
  /** Amount in agorot (minor units) — treasury columns store agorot throughout */
  amountAgorot: number;
  paymentId: string;
  userId: string;
  voteId?: string | null;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('record_treasury_deposit', {
    p_municipality_id: params.municipalityId,
    p_amount_ils: params.amountAgorot,
    p_payment_id: params.paymentId,
    p_user_id: params.userId,
    p_vote_id: params.voteId ?? null,
    p_description: params.description ?? 'Vote payment deposit',
  });

  if (error) {
    console.error('Failed to record treasury deposit:', error);
    throw error;
  }
  return data;
}

/**
 * Sum confirmed ILS deposits (agorot) accrued for a single vote.
 * This is the pool that gets seeded into the vote's Bags.fm bag at resolution.
 */
export async function getAccruedIlsForVote(voteId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('treasury_transactions')
    .select('amount_ils')
    .eq('vote_id', voteId)
    .eq('type', 'deposit')
    .eq('status', 'confirmed');

  if (error) {
    console.error('Failed to sum accrued ILS for vote:', error);
    throw error;
  }
  return (data || []).reduce((sum, row) => sum + (row.amount_ils || 0), 0);
}

/**
 * Record a treasury transaction (allocation, token_purchase, fee_claim, etc.).
 * Used by the bag-seeding flow to log the fiat→SOL conversion and liquidity add.
 */
export async function recordTreasuryTransaction(params: {
  treasuryId: string;
  type: TreasuryTransactionType;
  voteId?: string | null;
  amountIls?: number | null;
  amountSol?: number | null;
  description: string;
  bagsTxHash?: string | null;
  status?: 'pending' | 'confirmed' | 'failed';
  metadata?: Record<string, unknown> | null;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('treasury_transactions')
    .insert({
      treasury_id: params.treasuryId,
      type: params.type,
      vote_id: params.voteId ?? null,
      amount_ils: params.amountIls ?? null,
      amount_sol: params.amountSol != null ? String(params.amountSol) : null,
      description: params.description,
      bags_tx_hash: params.bagsTxHash ?? null,
      status: params.status ?? 'confirmed',
      metadata: params.metadata ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record treasury transaction:', error);
    throw error;
  }
  return data.id;
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

// === Vote NFT Functions ===

/**
 * Get votes that need resolution (ended but not resolved)
 */
export async function getVotesNeedingResolution() {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select('*')
    .in('status', ['active', 'ended'])
    .lte('end_date', new Date().toISOString())
    .is('resolution_status', null);

  if (error) {
    console.error('Failed to get votes needing resolution:', error);
    throw error;
  }
  return data || [];
}

/**
 * Update vote resolution status
 */
export async function updateVoteResolutionStatus(
  voteId: string,
  status: 'pending' | 'resolving' | 'resolved' | 'failed',
  resolvedAt?: Date
) {
  const updateData: Record<string, unknown> = {
    resolution_status: status,
  };

  if (status === 'resolved' && resolvedAt) {
    updateData.resolved_at = resolvedAt.toISOString();
    updateData.status = 'resolved';
  } else if (status === 'resolving') {
    updateData.status = 'resolving';
  } else if (status === 'failed') {
    updateData.status = 'failed';
  }

  const { data, error } = await supabaseAdmin
    .from('votes')
    .update(updateData)
    .eq('id', voteId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update vote resolution status:', error);
    throw error;
  }
  return data;
}

/**
 * Create a vote NFT record
 */
export async function createVoteNft(data: {
  voteId: string;
  userId?: string;
  walletAddress?: string;
  type: 'verified_voter' | 'civic_patron';
  metadata?: Record<string, unknown>;
}) {
  const { data: nft, error } = await supabaseAdmin
    .from('vote_nfts')
    .insert({
      vote_id: data.voteId,
      user_id: data.userId || null,
      wallet_address: data.walletAddress || null,
      type: data.type,
      metadata: data.metadata as Json | null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create vote NFT:', error);
    throw error;
  }
  return nft;
}

/**
 * Update vote NFT status
 */
export async function updateVoteNft(
  nftId: string,
  updates: {
    status?: 'pending' | 'minting' | 'minted' | 'failed';
    mintAddress?: string;
    metadataUri?: string;
    mintTxHash?: string;
    errorMessage?: string;
    retryCount?: number;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (updates.status !== undefined) {
    updateData.status = updates.status;
    if (updates.status === 'minted') {
      updateData.minted_at = new Date().toISOString();
    }
  }
  if (updates.mintAddress !== undefined) updateData.mint_address = updates.mintAddress;
  if (updates.metadataUri !== undefined) updateData.metadata_uri = updates.metadataUri;
  if (updates.mintTxHash !== undefined) updateData.mint_tx_hash = updates.mintTxHash;
  if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
  if (updates.retryCount !== undefined) updateData.retry_count = updates.retryCount;

  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .update(updateData)
    .eq('id', nftId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update vote NFT:', error);
    throw error;
  }
  return data;
}

/**
 * Get vote NFTs by vote ID
 */
export async function getVoteNftsByVoteId(
  voteId: string,
  options: { status?: 'pending' | 'minting' | 'minted' | 'failed'; limit?: number; offset?: number } = {}
) {
  const { status, limit = 100, offset = 0 } = options;

  let query = supabaseAdmin
    .from('vote_nfts')
    .select('*')
    .eq('vote_id', voteId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get vote NFTs:', error);
    throw error;
  }
  return data || [];
}

/**
 * Get vote NFTs by user ID
 * Returns NFTs without vote joins - caller should fetch vote details separately if needed
 */
export async function getVoteNftsByUserId(
  userId: string,
  options: { type?: 'verified_voter' | 'civic_patron'; limit?: number; offset?: number } = {}
) {
  const { type, limit = 50, offset = 0 } = options;

  let query = supabaseAdmin
    .from('vote_nfts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'minted')
    .order('minted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get user vote NFTs:', error);
    throw error;
  }

  return data || [];
}

/**
 * Count user's NFTs
 */
export async function countUserNfts(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'minted');

  if (error) {
    console.error('Failed to count user NFTs:', error);
    return 0;
  }
  return count || 0;
}

/**
 * Get NFT stats for a vote
 */
export async function getVoteNftStats(voteId: string): Promise<{
  total: number;
  verified_voters: number;
  civic_patrons: number;
  minted: number;
  pending: number;
  failed: number;
}> {
  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('type, status')
    .eq('vote_id', voteId);

  if (error) {
    console.error('Failed to get vote NFT stats:', error);
    return {
      total: 0,
      verified_voters: 0,
      civic_patrons: 0,
      minted: 0,
      pending: 0,
      failed: 0,
    };
  }

  const nfts = data || [];
  return {
    total: nfts.length,
    verified_voters: nfts.filter((n) => n.type === 'verified_voter').length,
    civic_patrons: nfts.filter((n) => n.type === 'civic_patron').length,
    minted: nfts.filter((n) => n.status === 'minted').length,
    pending: nfts.filter((n) => n.status === 'pending').length,
    failed: nfts.filter((n) => n.status === 'failed').length,
  };
}

/**
 * Get pending NFTs for minting (for batch processing)
 */
/** A pending NFT row with its mint recipient resolved (external wallet, else the user's wallet). */
export interface PendingNftWithRecipient {
  id: string;
  vote_id: string;
  type: 'verified_voter' | 'civic_patron';
  metadata: Record<string, unknown> | null;
  recipient: string | null;
}

/**
 * Pending NFTs across all votes, oldest first, for the batch minter. Recipient
 * is the external `wallet_address` (patrons) or the user's `qubik_wallet_address`
 * (voters); null when neither exists (left pending until a wallet is linked).
 */
export async function getPendingNfts(limit = 50): Promise<PendingNftWithRecipient[]> {
  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('id, vote_id, type, metadata, wallet_address, users(qubik_wallet_address)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to get pending NFTs:', error);
    return [];
  }

  return (data || []).map((row) => {
    const r = row as unknown as {
      id: string;
      vote_id: string;
      type: 'verified_voter' | 'civic_patron';
      metadata: Record<string, unknown> | null;
      wallet_address: string | null;
      users: { qubik_wallet_address: string | null } | null;
    };
    return {
      id: r.id,
      vote_id: r.vote_id,
      type: r.type,
      metadata: r.metadata,
      recipient: r.wallet_address || r.users?.qubik_wallet_address || null,
    };
  });
}

export async function getPendingNftsForVote(voteId: string, limit = 100) {
  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('*')
    .eq('vote_id', voteId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to get pending NFTs:', error);
    throw error;
  }
  return data || [];
}

/**
 * Get failed NFTs for retry (with retry count check)
 */
export async function getFailedNftsForRetry(voteId: string, maxRetries = 3, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('*')
    .eq('vote_id', voteId)
    .eq('status', 'failed')
    .lt('retry_count', maxRetries)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to get failed NFTs for retry:', error);
    throw error;
  }
  return data || [];
}

/**
 * Check if NFT exists for user/vote combination
 */
export async function hasVoteNft(voteId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('*', { count: 'exact', head: true })
    .eq('vote_id', voteId)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to check vote NFT existence:', error);
    return false;
  }
  return (count || 0) > 0;
}

/**
 * Bulk create vote NFT records
 */
export async function bulkCreateVoteNfts(
  records: Array<{
    voteId: string;
    userId?: string;
    walletAddress?: string;
    type: 'verified_voter' | 'civic_patron';
    metadata?: Record<string, unknown>;
  }>
) {
  const insertData = records.map((record) => ({
    vote_id: record.voteId,
    user_id: record.userId || null,
    wallet_address: record.walletAddress || null,
    type: record.type,
    metadata: (record.metadata || null) as Json | null,
    status: 'pending' as const,
  }));

  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .insert(insertData)
    .select();

  if (error) {
    console.error('Failed to bulk create vote NFTs:', error);
    throw error;
  }
  return data || [];
}

// ============================================
// MERCH ORDER OPERATIONS
// ============================================

/** Persist a new merch order (status 'pending') at checkout. */
export async function createMerchOrder(
  record: InsertTables<'merch_orders'>
): Promise<MerchOrderRow> {
  const { data, error } = await supabaseAdmin
    .from('merch_orders')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Failed to create merch order:', error);
    throw error;
  }
  return data;
}

/** Read a merch order by id (source of truth for the thank-you page). */
export async function getMerchOrderById(
  id: string
): Promise<MerchOrderRow | null> {
  const { data, error } = await supabaseAdmin
    .from('merch_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch merch order:', error);
    return null;
  }
  return data;
}

/** Patch a merch order (webhook status flips, payment/POD ids). */
export async function updateMerchOrder(
  id: string,
  updates: UpdateTables<'merch_orders'>
): Promise<MerchOrderRow | null> {
  const { data, error } = await supabaseAdmin
    .from('merch_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update merch order:', error);
    return null;
  }
  return data;
}

/** Outcome of an atomic paid transition — distinguishes a no-op from a failure. */
export type MarkPaidResult =
  | { kind: 'updated'; row: MerchOrderRow }
  | { kind: 'noop' } // no pending row matched: already settled, or lost the race
  | { kind: 'error' }; // transient DB failure — caller should signal a retry

/**
 * Atomically flip an order `pending` → `paid`. The `status = 'pending'` guard
 * is enforced in the same statement, so concurrent webhook deliveries can't
 * both succeed — the loser matches zero rows and returns `noop` (idempotent).
 */
export async function markMerchOrderPaid(
  id: string,
  paymentId: string | null
): Promise<MarkPaidResult> {
  const { data, error } = await supabaseAdmin
    .from('merch_orders')
    .update({
      status: 'paid',
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to mark merch order paid:', error);
    return { kind: 'error' };
  }
  return data ? { kind: 'updated', row: data } : { kind: 'noop' };
}
