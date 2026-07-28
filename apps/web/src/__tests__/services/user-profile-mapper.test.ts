/**
 * User Profile Mapper Tests
 *
 * Focused tests for the single canonical mapping between a Supabase `users`
 * row and the client-facing profile shape (`@/services/user/profile`).
 *
 * These lock down the contract that the auth routes and /api/user/profile all
 * depend on: `identityScore` and `verificationStatus` are OBJECTS, never raw
 * database scalars.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('@/services/qubik', () => ({
  qubikService: {
    getTokenBalance: vi.fn(),
    createWallet: vi.fn(),
  },
}));

import {
  transformToProfile,
  mapVerificationStatus,
  mapSocialProofs,
  getTokenBalanceSafe,
  buildUserProfile,
  QUBIK_BALANCE_TIMEOUT_MS,
} from '@/services/user/profile';
import { qubikService } from '@/services/qubik';
import type { User, SocialProof as DbSocialProof } from '@/lib/supabase/types';

const baseUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+972501234567',
  municipality_id: 'tel-aviv',
  city: 'תל אביב',
  notification_settings: { newVotes: true, voteEnding: false, voteResults: true, marketing: false },
  did: 'did:sync:' + 'a'.repeat(43),
  did_public_key: 'pk',
  did_encrypted_private_key: 'epk',
  google_id: 'google-123',
  avatar_url: 'https://example.com/avatar.jpg',
  identity_score: 40,
  verification_status: 'none',
  qubik_wallet_address: 'wallet-123',
  municipality_rating: null,
  municipality_rated_at: null,
  identity_verified_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-02-02T00:00:00Z',
};

const googleProof: DbSocialProof = {
  id: 'proof-1',
  user_id: 'user-123',
  provider: 'google',
  provider_id: 'google-123',
  provider_email: 'test@example.com',
  provider_name: 'Test User',
  provider_avatar: 'https://example.com/g.jpg',
  access_token_encrypted: null,
  connected_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
} as DbSocialProof;

const facebookProof: DbSocialProof = {
  ...googleProof,
  id: 'proof-2',
  provider: 'facebook',
  provider_id: 'fb-456',
  provider_name: null,
  provider_email: 'fb@example.com',
  provider_avatar: null,
} as DbSocialProof;

describe('mapVerificationStatus', () => {
  it("maps 'verified' to phase 'completed'", () => {
    expect(mapVerificationStatus('verified')).toEqual({ phase: 'completed' });
  });

  it("maps 'pending' to phase 'in_progress'", () => {
    expect(mapVerificationStatus('pending')).toEqual({ phase: 'in_progress' });
  });

  it("maps 'failed' to phase 'failed'", () => {
    expect(mapVerificationStatus('failed')).toEqual({ phase: 'failed' });
  });

  it("maps 'none' to phase 'not_started'", () => {
    expect(mapVerificationStatus('none')).toEqual({ phase: 'not_started' });
  });

  it('never fabricates check-in counts (they live in verification_runs)', () => {
    const status = mapVerificationStatus('pending');
    expect(status.checkInsCompleted).toBeUndefined();
    expect(status.checkInsTotal).toBeUndefined();
  });
});

describe('mapSocialProofs', () => {
  it('maps provider rows onto the shared SocialProof shape', () => {
    const [proof] = mapSocialProofs([googleProof]);

    expect(proof.platform).toBe('google');
    expect(proof.providerId).toBe('google-123');
    expect(proof.displayName).toBe('Test User');
    expect(proof.email).toBe('test@example.com');
    expect(proof.profileImage).toBe('https://example.com/g.jpg');
    expect(proof.stampWeight).toBe(40);
    expect(proof.connectedAt).toBeInstanceOf(Date);
  });

  it('falls back to the provider email when the display name is null', () => {
    const [proof] = mapSocialProofs([facebookProof]);

    expect(proof.displayName).toBe('fb@example.com');
    expect(proof.profileImage).toBeUndefined();
    expect(proof.stampWeight).toBe(10);
  });

  it('returns an empty array for no proofs', () => {
    expect(mapSocialProofs([])).toEqual([]);
  });
});

describe('transformToProfile', () => {
  it('returns identityScore as an object, not the raw identity_score column', () => {
    const profile = transformToProfile({ ...baseUser, identity_score: 70 }, [googleProof]);

    expect(typeof profile.identityScore).toBe('object');
    expect(profile.identityScore.total).toBe(40);
    expect(profile.identityScore.level).toBe('basic');
    expect(profile.identityScore.breakdown).toEqual({
      gps: 0,
      google: 40,
      facebook: 0,
      instagram: 0,
    });
  });

  it('reaches the verified level once enough social proofs are connected', () => {
    const profile = transformToProfile(baseUser, [
      googleProof,
      facebookProof,
      { ...facebookProof, id: 'proof-3', provider: 'instagram' } as DbSocialProof,
    ]);

    expect(profile.identityScore.total).toBe(60);
    expect(profile.identityScore.level).toBe('verified');
  });

  it('returns verificationStatus as an object for a verified user', () => {
    const profile = transformToProfile(
      { ...baseUser, verification_status: 'verified' },
      [googleProof]
    );

    expect(typeof profile.verificationStatus).toBe('object');
    expect(profile.verificationStatus.phase).toBe('completed');
  });

  it('carries the token balance through', () => {
    const profile = transformToProfile(baseUser, [googleProof], 250);
    expect(profile.syncTokenBalance).toBe(250);
  });

  it('defaults the token balance to 0 when not supplied', () => {
    expect(transformToProfile(baseUser, []).syncTokenBalance).toBe(0);
  });

  it('exposes every field the dashboard depends on', () => {
    const profile = transformToProfile(baseUser, [googleProof], 12);

    expect(profile.id).toBe('user-123');
    expect(profile.email).toBe('test@example.com');
    expect(profile.firstName).toBe('Test');
    expect(profile.lastName).toBe('User');
    expect(profile.phone).toBe('+972501234567');
    expect(profile.municipality).toBe('tel-aviv');
    expect(profile.city).toBe('תל אביב');
    expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(profile.googleId).toBe('google-123');
    expect(profile.did).toBe(baseUser.did);
    expect(profile.qubikWalletAddress).toBe('wallet-123');
    expect(profile.notificationSettings).toEqual(baseUser.notification_settings);
    expect(profile.createdAt).toBe('2025-01-01T00:00:00Z');
    expect(profile.updatedAt).toBe('2025-02-02T00:00:00Z');
  });

  it('handles nullable columns without inventing values', () => {
    const sparse: User = {
      ...baseUser,
      first_name: null,
      last_name: null,
      phone: null,
      municipality_id: null,
      city: null,
      avatar_url: null,
      notification_settings: null,
      did: null,
      google_id: null,
      qubik_wallet_address: null,
    };

    const profile = transformToProfile(sparse, []);

    // Names collapse to '' because the shared type declares them as strings.
    expect(profile.firstName).toBe('');
    expect(profile.lastName).toBe('');
    // Everything else stays null rather than being papered over.
    expect(profile.phone).toBeNull();
    expect(profile.municipality).toBeNull();
    expect(profile.city).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.did).toBeNull();
    expect(profile.googleId).toBeNull();
    expect(profile.qubikWalletAddress).toBeNull();
    expect(profile.notificationSettings).toBeUndefined();
    expect(profile.socialProofs).toEqual([]);
    expect(profile.identityScore.total).toBe(0);
  });
});

describe('getTokenBalanceSafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 without calling Qubik when the user has no wallet', async () => {
    const balance = await getTokenBalanceSafe({ ...baseUser, qubik_wallet_address: null });

    expect(balance).toBe(0);
    expect(qubikService.getTokenBalance).not.toHaveBeenCalled();
  });

  it('returns the balance from Qubik', async () => {
    (qubikService.getTokenBalance as Mock).mockResolvedValue(77);

    await expect(getTokenBalanceSafe(baseUser)).resolves.toBe(77);
    expect(qubikService.getTokenBalance).toHaveBeenCalledWith('wallet-123');
  });

  it('degrades to 0 when Qubik is unavailable rather than throwing', async () => {
    (qubikService.getTokenBalance as Mock).mockRejectedValue(new Error('Qubik down'));

    await expect(getTokenBalanceSafe(baseUser)).resolves.toBe(0);
  });

  it('degrades to 0 when Qubik hangs, so authentication cannot stall', async () => {
    // A request that never settles — the failure mode a bare `fetch` with no
    // timeout exposes on the auth hot path.
    (qubikService.getTokenBalance as Mock).mockReturnValue(new Promise(() => {}));

    await expect(getTokenBalanceSafe(baseUser, 10)).resolves.toBe(0);
  });

  it('has a bounded default timeout', () => {
    expect(QUBIK_BALANCE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(QUBIK_BALANCE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});

describe('buildUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines the balance lookup with the mapping', async () => {
    (qubikService.getTokenBalance as Mock).mockResolvedValue(5);

    const profile = await buildUserProfile(
      { ...baseUser, verification_status: 'verified' },
      [googleProof]
    );

    expect(profile.syncTokenBalance).toBe(5);
    expect(profile.verificationStatus.phase).toBe('completed');
    expect(profile.identityScore.level).toBe('basic');
  });
});
