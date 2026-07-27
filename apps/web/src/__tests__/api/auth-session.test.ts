/**
 * Auth Session API Route Tests
 *
 * Tests for the /api/auth/session endpoints:
 * - POST /api/auth/session - Validate session
 * - DELETE /api/auth/session - Sign out
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/auth/session/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
  clearSessionCookies: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getSocialProofsByUserId: vi.fn(),
}));

// Mock external services (the canonical profile mapper reads the token balance)
vi.mock('@/services/qubik', () => ({
  qubikService: {
    getTokenBalance: vi.fn(),
    createWallet: vi.fn(),
  },
}));

// Import mocked modules
import { getSessionFromRequest, clearSessionCookies } from '@/services/auth/session';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';
import { qubikService } from '@/services/qubik';

describe('Auth Session API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockUser = {
    id: 'user-123',
    google_id: 'google-123',
    did: 'did:sync:' + 'a'.repeat(43),
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '+972501234567',
    avatar_url: 'https://example.com/avatar.jpg',
    identity_score: 70,
    verification_status: 'verified',
    municipality_id: 'tel-aviv',
    city: 'תל אביב',
    notification_settings: { newVotes: true, voteEnding: true, voteResults: true, marketing: false },
    qubik_wallet_address: 'wallet-123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-02-02T00:00:00Z',
  };

  const mockSocialProofs = [
    {
      provider: 'google',
      provider_id: 'google-123',
      provider_name: 'Test User',
      provider_email: 'test@example.com',
      provider_avatar: null,
      connected_at: '2025-01-01T00:00:00Z',
    },
    {
      provider: 'facebook',
      provider_id: 'facebook-456',
      provider_name: 'Test FB',
      provider_email: null,
      provider_avatar: null,
      connected_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (qubikService.getTokenBalance as Mock).mockResolvedValue(0);
  });

  describe('POST /api/auth/session', () => {
    it('should return 401 when session is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid session');
      expect(data.code).toBe('INVALID_SESSION');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
      expect(data.code).toBe('USER_NOT_FOUND');
    });

    it('should validate session and return user data successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(42);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('user-123');
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.firstName).toBe('Test');
      expect(data.user.lastName).toBe('User');
      expect(data.user.municipality).toBe('tel-aviv');
      expect(data.session).toBeDefined();
      expect(data.session.userId).toBe('user-123');
    });

    it('should return the canonical rich profile shape, not raw DB columns', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(42);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const data = await (await POST(request)).json();

      // verification_status='verified' must surface as an OBJECT with a phase,
      // which is what the dashboard reads. Previously this was the raw enum
      // string and every user rendered as unverified.
      expect(typeof data.user.verificationStatus).toBe('object');
      expect(data.user.verificationStatus.phase).toBe('completed');

      // identity_score must surface as the computed IdentityScore object,
      // never the raw integer column.
      expect(typeof data.user.identityScore).toBe('object');
      expect(data.user.identityScore.total).toBe(50); // google 40 + facebook 10
      expect(data.user.identityScore.level).toBe('basic');
      expect(data.user.identityScore.breakdown).toEqual({
        gps: 0,
        google: 40,
        facebook: 10,
        instagram: 0,
      });

      // Social proofs are full objects, not a bare provider-name array.
      expect(Array.isArray(data.user.socialProofs)).toBe(true);
      expect(data.user.socialProofs).toHaveLength(2);
      expect(data.user.socialProofs[0].platform).toBe('google');
      expect(data.user.socialProofs[0].stampWeight).toBe(40);

      // Fields the dashboard needs that the old hand-rolled mapping dropped.
      expect(data.user.syncTokenBalance).toBe(42);
      expect(data.user.city).toBe('תל אביב');
      expect(data.user.phone).toBe('+972501234567');
      expect(data.user.notificationSettings).toEqual(mockUser.notification_settings);
      expect(data.user.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should map an unverified user to phase not_started', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({
        ...mockUser,
        verification_status: 'none',
      });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const data = await (await POST(request)).json();

      expect(data.user.verificationStatus.phase).toBe('not_started');
    });

    it('should handle nullable profile columns without inventing values', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({
        ...mockUser,
        first_name: null,
        last_name: null,
        phone: null,
        city: null,
        municipality_id: null,
        notification_settings: null,
        qubik_wallet_address: null,
      });
      (getSocialProofsByUserId as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const data = await (await POST(request)).json();

      expect(data.user.firstName).toBe('');
      expect(data.user.lastName).toBe('');
      expect(data.user.phone).toBeNull();
      expect(data.user.city).toBeNull();
      expect(data.user.municipality).toBeNull();
      expect(data.user.notificationSettings).toBeUndefined();
      expect(data.user.socialProofs).toEqual([]);
      expect(data.user.identityScore.total).toBe(0);
      // No wallet means no blockchain call at all.
      expect(data.user.syncTokenBalance).toBe(0);
      expect(qubikService.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Session validation failed');
      expect(data.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('DELETE /api/auth/session', () => {
    it('should sign out successfully', async () => {
      (clearSessionCookies as Mock).mockResolvedValue(undefined);

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Signed out successfully');
      expect(clearSessionCookies).toHaveBeenCalledTimes(1);
    });

    it('should handle sign out errors gracefully', async () => {
      (clearSessionCookies as Mock).mockRejectedValue(new Error('Failed to clear cookies'));

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Sign out failed');
      expect(data.code).toBe('SIGNOUT_FAILED');
    });
  });
});
