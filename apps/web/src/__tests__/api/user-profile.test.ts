/**
 * User Profile API Route Tests
 *
 * Tests for the /api/user/profile endpoints:
 * - GET /api/user/profile - Get current user profile
 * - POST /api/user/profile - Create new user profile
 * - PATCH /api/user/profile - Update user profile
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '@/app/api/user/profile/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  getSocialProofsByUserId: vi.fn(),
  createSocialProof: vi.fn(),
}));

// Mock external services
vi.mock('@/services/qubik', () => ({
  qubikService: {
    createWallet: vi.fn(),
    getTokenBalance: vi.fn(),
  },
}));

vi.mock('@/services/email', () => ({
  emailService: {
    sendWelcomeEmail: vi.fn(),
  },
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  getSocialProofsByUserId,
  createSocialProof,
} from '@/lib/supabase/db';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

describe('User Profile API Routes', () => {
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
    qubik_wallet_address: 'wallet-123',
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '+972501234567',
    municipality_id: 'tel-aviv',
    avatar_url: null,
    identity_score: 40,
    verification_status: 'none',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockSocialProofs = [
    {
      id: 'proof-1',
      user_id: 'user-123',
      provider: 'google',
      provider_id: 'google-123',
      provider_email: 'test@example.com',
      provider_name: 'Test User',
      provider_avatar: null,
      connected_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Profile not found');
    });

    it('should return user profile successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(100);

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toBeDefined();
      expect(data.profile.id).toBe('user-123');
      expect(data.profile.email).toBe('test@example.com');
      expect(data.profile.firstName).toBe('Test');
      expect(data.profile.lastName).toBe('User');
      expect(data.profile.municipality).toBe('tel-aviv');
      expect(data.profile.syncTokenBalance).toBe(100);
      expect(data.profile.identityScore).toBeDefined();
    });

    it('should use the canonical mapper shape shared with the auth routes', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue({
        ...mockUser,
        verification_status: 'verified',
      });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(100);

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const data = await (await GET(request)).json();

      expect(typeof data.profile.verificationStatus).toBe('object');
      expect(data.profile.verificationStatus.phase).toBe('completed');
      // Check-in counts belong to /api/verification/status; this route must not
      // fabricate zeros for them.
      expect(data.profile.verificationStatus.checkInsCompleted).toBeUndefined();
      expect(data.profile.verificationStatus.checkInsTotal).toBeUndefined();

      expect(typeof data.profile.identityScore).toBe('object');
      // google 40 + GPS 20 (verification_status='verified')
      expect(data.profile.identityScore.total).toBe(60);
      expect(data.profile.identityScore.level).toBe('basic');
      expect(data.profile.socialProofs[0].platform).toBe('google');
    });

    it('should handle Qubik service failure gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockRejectedValue(new Error('Qubik unavailable'));

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.syncTokenBalance).toBe(0);
    });

    it('should calculate correct verification status', async () => {
      const verifiedUser = { ...mockUser, verification_status: 'verified' };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(verifiedUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(data.profile.verificationStatus.phase).toBe('completed');
    });
  });

  describe('POST /api/user/profile', () => {
    const validProfileData = {
      municipality: 'tel-aviv',
      firstName: 'Test',
      lastName: 'User',
      phone: '+972501234567',
    };

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when profile already exists', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Profile already exists');
    });

    it('should return 400 when municipality is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'Test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Municipality is required');
    });

    it('should return 503 when Qubik wallet creation fails', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);
      (qubikService.createWallet as Mock).mockRejectedValue(new Error('Wallet service down'));

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('Wallet service unavailable');
    });

    it('should create profile successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);
      (qubikService.createWallet as Mock).mockResolvedValue('new-wallet-123');
      (createUser as Mock).mockResolvedValue({
        ...mockUser,
        id: 'new-user-123',
        qubik_wallet_address: 'new-wallet-123',
      });
      (createSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (emailService.sendWelcomeEmail as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.profile).toBeDefined();
      expect(qubikService.createWallet).toHaveBeenCalledWith(mockSession.userId);
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          google_id: mockSession.googleId,
          municipality_id: validProfileData.municipality,
          qubik_wallet_address: 'new-wallet-123',
        })
      );
      expect(createSocialProof).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('should handle email service failure gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);
      (qubikService.createWallet as Mock).mockResolvedValue('new-wallet-123');
      (createUser as Mock).mockResolvedValue({ ...mockUser, id: 'new-user-123' });
      (createSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (emailService.sendWelcomeEmail as Mock).mockRejectedValue(new Error('Email failed'));

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData),
      });
      const response = await POST(request);

      // Should still succeed even if email fails
      expect(response.status).toBe(201);
    });
  });

  describe('PATCH /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Updated' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Updated' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Profile not found');
    });

    it('should return current profile when no valid updates provided', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ invalidField: 'value' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toBeDefined();
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('should update profile successfully', async () => {
      const updatedUser = {
        ...mockUser,
        first_name: 'Updated',
        last_name: 'Name',
      };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (updateUser as Mock).mockResolvedValue(updatedUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(50);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Updated', lastName: 'Name' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.firstName).toBe('Updated');
      expect(data.profile.lastName).toBe('Name');
      expect(updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          first_name: 'Updated',
          last_name: 'Name',
        })
      );
    });

    it('should map camelCase fields to snake_case correctly', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (updateUser as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: 'First',
          lastName: 'Last',
          municipality: 'ירושלים',
          phone: '+972509999999',
        }),
      });
      await PATCH(request);

      expect(updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          first_name: 'First',
          last_name: 'Last',
          municipality_id: 'ירושלים',
          phone: '+972509999999',
        })
      );
    });

    it('should reject an unknown municipality with 400', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ municipality: 'jerusalem' }),
      });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('should return 500 when update fails', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (updateUser as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: 'Updated' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update profile');
    });
  });
});
