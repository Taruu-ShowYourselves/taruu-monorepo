/**
 * User Profile Mapper
 *
 * Single source of truth for turning a Supabase `users` row into the profile
 * shape the clients consume. Every authenticated surface - session validation,
 * session refresh, OAuth callback and `/api/user/profile` - MUST go through
 * this module so the browser only ever sees one user shape.
 *
 * Before this existed each auth route hand-rolled its own mapping and leaked
 * raw database columns (`identity_score` as a number, `verification_status` as
 * an enum string) under field names that `@sync/shared` declares as objects.
 * The dashboard reads `user.identityScore.level` and
 * `user.verificationStatus.phase`, so those raw values silently read as
 * `undefined` and every user appeared unverified with a zero score.
 */

import { calculateIdentityScore, IDENTITY_SCORE_WEIGHTS } from '@sync/shared';
import type {
  IdentityScore,
  NotificationSettings,
  SocialProof,
  VerificationStatus,
} from '@sync/shared';
import type { User, SocialProof as DbSocialProof } from '@/lib/supabase/types';
import { qubikService } from '@/services/qubik';

/**
 * The profile shape returned by every authenticated endpoint.
 *
 * This deliberately mirrors `@sync/shared`'s `UserProfile` without claiming to
 * BE it: the database allows NULL for several columns that `UserProfile` types
 * as required, and timestamps cross the wire as ISO strings rather than `Date`.
 * Declaring the honest shape here keeps the mismatch visible instead of hiding
 * it behind a cast or widening the shared contract to fit a lossy API.
 */
export interface MappedUserProfile {
  id: string;
  googleId: string | null;
  did: string | null;
  qubikWalletAddress: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  municipality: string | null;
  city: string | null;
  avatarUrl: string | null;
  notificationSettings?: NotificationSettings;
  verificationStatus: VerificationStatus;
  socialProofs: SocialProof[];
  identityScore: IdentityScore;
  syncTokenBalance: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map the `users.verification_status` enum onto the shared `VerificationStatus`
 * object. Only the phase can be derived from the users row; check-in counts
 * live in `verification_runs` / `verification_schedule` and are served by
 * `/api/verification/status`, which queries them directly.
 */
export function mapVerificationStatus(
  status: User['verification_status']
): VerificationStatus {
  switch (status) {
    case 'verified':
      return { phase: 'completed' };
    case 'pending':
      return { phase: 'in_progress' };
    case 'failed':
      return { phase: 'failed' };
    default:
      return { phase: 'not_started' };
  }
}

/**
 * Map database social proof rows onto the shared `SocialProof` shape.
 */
export function mapSocialProofs(socialProofs: DbSocialProof[]): SocialProof[] {
  return socialProofs.map((proof) => ({
    platform: proof.provider,
    providerId: proof.provider_id,
    displayName: proof.provider_name || proof.provider_email || '',
    email: proof.provider_email || undefined,
    profileUrl: undefined,
    profileImage: proof.provider_avatar || undefined,
    connectedAt: new Date(proof.connected_at),
    stampWeight: IDENTITY_SCORE_WEIGHTS[proof.provider] || 0,
  }));
}

/**
 * How long we are willing to wait for the Qubik balance lookup before giving
 * up. `qubikService.getTokenBalance` is a bare `fetch` with no timeout of its
 * own, and this helper now runs on the authentication hot path
 * (`POST /api/auth/session` fires on every page load), so an unresponsive
 * Qubik must not be able to stall sign-in.
 */
export const QUBIK_BALANCE_TIMEOUT_MS = 2000;

/**
 * Reject if `promise` has not settled within `ms`.
 *
 * The underlying request is not cancelled - `getTokenBalance` exposes no
 * AbortSignal - but the caller stops waiting on it, which is what protects the
 * auth response.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Qubik balance lookup timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Read the user's SYNC token balance from the blockchain.
 *
 * Neither a Qubik error nor a Qubik hang may break authentication, so this
 * swallows both and returns 0. That 0 is indistinguishable from a genuine zero
 * balance - a known wart carried over from the original `/api/user/profile`
 * implementation, kept here so behaviour is unchanged.
 */
export async function getTokenBalanceSafe(
  user: User,
  timeoutMs: number = QUBIK_BALANCE_TIMEOUT_MS
): Promise<number> {
  if (!user.qubik_wallet_address) return 0;

  try {
    return await withTimeout(
      qubikService.getTokenBalance(user.qubik_wallet_address),
      timeoutMs
    );
  } catch (e) {
    // Qubik might not be configured in dev, or may be unresponsive.
    console.warn('Could not fetch token balance:', e);
    return 0;
  }
}

/**
 * Transform a Supabase user row (plus its social proofs) into the canonical
 * client-facing profile.
 */
export function transformToProfile(
  user: User,
  socialProofs: DbSocialProof[],
  tokenBalance: number = 0
): MappedUserProfile {
  const transformedProofs = mapSocialProofs(socialProofs);

  return {
    id: user.id,
    googleId: user.google_id,
    did: user.did,
    qubikWalletAddress: user.qubik_wallet_address,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    email: user.email,
    phone: user.phone,
    municipality: user.municipality_id,
    city: user.city,
    avatarUrl: user.avatar_url,
    notificationSettings:
      (user.notification_settings as NotificationSettings | null) ?? undefined,
    verificationStatus: mapVerificationStatus(user.verification_status),
    socialProofs: transformedProofs,
    identityScore: calculateIdentityScore(
      transformedProofs,
      user.verification_status === 'verified',
      {
        phoneVerified: user.phone_verified === true,
        // != null: a row missing the column (older fixtures/partial selects)
        // must score 0, exactly like an explicit NULL.
        idDocumentApproved: user.identity_verified_at != null,
      }
    ),
    syncTokenBalance: tokenBalance,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Convenience wrapper: fetch the token balance and build the profile in one go.
 * Used by the auth routes, which have no other reason to talk to Qubik.
 */
export async function buildUserProfile(
  user: User,
  socialProofs: DbSocialProof[]
): Promise<MappedUserProfile> {
  const tokenBalance = await getTokenBalanceSafe(user);
  return transformToProfile(user, socialProofs, tokenBalance);
}
