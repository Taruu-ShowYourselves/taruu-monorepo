/**
 * Social Callback API Route Tests
 *
 * Tests for the social OAuth callback endpoints:
 * - GET /api/social/callback/facebook - Handle Facebook OAuth callback
 * - GET /api/social/callback/instagram - Handle Instagram OAuth callback
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock Facebook auth service
vi.mock('@/services/auth/facebook', () => ({
  exchangeCodeForTokens: vi.fn(),
  getLongLivedToken: vi.fn(),
  getFacebookUserInfo: vi.fn(),
}));

// Mock Instagram auth service
vi.mock('@/services/auth/instagram', () => ({
  exchangeCodeForTokens: vi.fn(),
  getLongLivedToken: vi.fn(),
  getInstagramUserInfo: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
  getSocialProofsByUserId: vi.fn(),
  upsertSocialProof: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock OAuth state
vi.mock('@/lib/oauth-state', () => ({
  verifyOAuthState: vi.fn(),
  verifyOAuthStatePlatform: vi.fn(),
}));

// Mock identity score utility
vi.mock('@sync/shared', () => ({
  calculateIdentityScore: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  exchangeCodeForTokens as fbExchange,
  getLongLivedToken as fbLongLived,
  getFacebookUserInfo,
} from '@/services/auth/facebook';
import {
  exchangeCodeForTokens as igExchange,
  getLongLivedToken as igLongLived,
  getInstagramUserInfo,
} from '@/services/auth/instagram';
import {
  getUserByGoogleId,
  getSocialProofsByUserId,
  upsertSocialProof,
  updateUser,
} from '@/lib/supabase/db';
import { verifyOAuthState, verifyOAuthStatePlatform } from '@/lib/oauth-state';
import { calculateIdentityScore } from '@sync/shared';

describe('Social Callback API Routes', () => {
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
    email: 'test@example.com',
    identity_score: 40,
  };

  const mockSocialProofs = [
    {
      provider: 'google',
      provider_id: 'google-123',
      provider_name: 'Test User',
      provider_email: 'test@example.com',
      connected_at: '2025-01-01T00:00:00Z',
    },
  ];

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: 'https://taruu.co.il',
      FACEBOOK_APP_ID: 'facebook-app-id',
      FACEBOOK_APP_SECRET: 'facebook-app-secret',
      INSTAGRAM_APP_ID: 'instagram-app-id',
      INSTAGRAM_APP_SECRET: 'instagram-app-secret',
      JWT_SECRET: 'test-jwt-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/social/callback/facebook', () => {
    let GET: typeof import('@/app/api/social/callback/facebook/route').GET;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('@/app/api/social/callback/facebook/route');
      GET = module.GET;
    });

    it('should redirect to error when code is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should redirect to error when state is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should redirect to error when state is invalid', async () => {
      (verifyOAuthState as Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code&state=invalid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
    });

    it('should redirect to error when platform mismatch', async () => {
      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'instagram',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(false);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
    });

    it('should successfully connect Facebook account', async () => {
      const mockFbUser = {
        id: 'fb-123',
        name: 'Test User',
        email: 'test@facebook.com',
      };

      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'facebook',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (fbExchange as Mock).mockResolvedValue({ access_token: 'short-token' });
      (fbLongLived as Mock).mockResolvedValue({ access_token: 'long-token', expires_in: 5184000 });
      (getFacebookUserInfo as Mock).mockResolvedValue(mockFbUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (upsertSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (calculateIdentityScore as Mock).mockReturnValue({ total: 50, breakdown: {} });
      (updateUser as Mock).mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('success=facebook');
      expect(upsertSocialProof).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          provider: 'facebook',
          provider_id: 'fb-123',
        })
      );
    });

    it('should redirect to error on session mismatch', async () => {
      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'different-user',
        platform: 'facebook',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (fbExchange as Mock).mockResolvedValue({ access_token: 'short-token' });
      (fbLongLived as Mock).mockResolvedValue({ access_token: 'long-token' });
      (getFacebookUserInfo as Mock).mockResolvedValue({ id: 'fb-123', name: 'Test' });
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
    });

    it('should redirect to error on Facebook API error', async () => {
      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'facebook',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (fbExchange as Mock).mockRejectedValue(new Error('Facebook API error'));

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
    });

    it('should handle Facebook error parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/facebook?error=access_denied&error_description=User%20denied%20access',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
      expect(location).toContain('User');
    });
  });

  describe('GET /api/social/callback/instagram', () => {
    let GET: typeof import('@/app/api/social/callback/instagram/route').GET;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('@/app/api/social/callback/instagram/route');
      GET = module.GET;
    });

    it('should redirect to error when code is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/instagram?state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should redirect to error when state is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/instagram?code=auth-code',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should successfully connect Instagram account', async () => {
      const mockIgUser = {
        id: 'ig-123',
        username: 'testuser',
        account_type: 'PERSONAL',
      };

      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'instagram',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (igExchange as Mock).mockResolvedValue({ access_token: 'short-token', user_id: 'ig-123' });
      (igLongLived as Mock).mockResolvedValue({ access_token: 'long-token', expires_in: 5184000 });
      (getInstagramUserInfo as Mock).mockResolvedValue(mockIgUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (upsertSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (calculateIdentityScore as Mock).mockReturnValue({ total: 50, breakdown: {} });
      (updateUser as Mock).mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/instagram?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('success=instagram');
    });

    it('should redirect to error on Instagram API error', async () => {
      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'instagram',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (igExchange as Mock).mockRejectedValue(new Error('Instagram API error'));

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/instagram?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('error=');
    });

    it('should update identity score after successful connection', async () => {
      const mockIgUser = {
        id: 'ig-123',
        username: 'testuser',
        account_type: 'PERSONAL',
      };

      (verifyOAuthState as Mock).mockResolvedValue({
        userId: 'user-123',
        platform: 'instagram',
        nonce: 'nonce',
      });
      (verifyOAuthStatePlatform as Mock).mockReturnValue(true);
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (igExchange as Mock).mockResolvedValue({ access_token: 'short-token', user_id: 'ig-123' });
      (igLongLived as Mock).mockResolvedValue({ access_token: 'long-token', expires_in: 5184000 });
      (getInstagramUserInfo as Mock).mockResolvedValue(mockIgUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (upsertSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (getSocialProofsByUserId as Mock).mockResolvedValue([
        ...mockSocialProofs,
        {
          provider: 'instagram',
          provider_id: 'ig-123',
          provider_name: 'testuser',
          provider_email: null,
          connected_at: '2025-01-10T00:00:00Z',
        },
      ]);
      (calculateIdentityScore as Mock).mockReturnValue({
        total: 60,
        breakdown: { google: 40, instagram: 20 },
      });
      (updateUser as Mock).mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/social/callback/instagram?code=auth-code&state=valid-state',
        { method: 'GET' }
      );
      await GET(request);

      expect(updateUser).toHaveBeenCalledWith('user-123', { identity_score: 60 });
    });
  });
});
