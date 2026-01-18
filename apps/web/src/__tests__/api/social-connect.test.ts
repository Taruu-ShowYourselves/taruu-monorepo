/**
 * Social Connect API Route Tests
 *
 * Tests for the social connection initiation endpoints:
 * - GET /api/social/connect/facebook - Initiate Facebook OAuth
 * - GET /api/social/connect/instagram - Initiate Instagram OAuth
 */

import { describe, it, expect, beforeEach, afterAll, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock Facebook auth service
vi.mock('@/services/auth/facebook', () => ({
  buildFacebookAuthUrl: vi.fn(),
}));

// Mock Instagram auth service
vi.mock('@/services/auth/instagram', () => ({
  buildInstagramAuthUrl: vi.fn(),
}));

// Mock OAuth state
vi.mock('@/lib/oauth-state', () => ({
  createOAuthState: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { buildFacebookAuthUrl } from '@/services/auth/facebook';
import { buildInstagramAuthUrl } from '@/services/auth/instagram';
import { createOAuthState } from '@/lib/oauth-state';

describe('Social Connect API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

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

  describe('GET /api/social/connect/facebook', () => {
    let GET: typeof import('@/app/api/social/connect/facebook/route').GET;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('@/app/api/social/connect/facebook/route');
      GET = module.GET;
    });

    it('should redirect to sign-in when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/social/connect/facebook', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('/sign-in');
      expect(location).toContain('error=unauthenticated');
    });

    it('should redirect to Facebook OAuth URL when authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (createOAuthState as Mock).mockResolvedValue('state-token');
      (buildFacebookAuthUrl as Mock).mockReturnValue(
        'https://facebook.com/dialog/oauth?client_id=facebook-app-id&redirect_uri=https%3A%2F%2Ftaruu.co.il%2Fapi%2Fsocial%2Fcallback%2Ffacebook&state=state-token&scope=public_profile,email'
      );

      const request = new NextRequest('http://localhost:3000/api/social/connect/facebook', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('facebook.com');
      expect(location).toContain('oauth');
      expect(createOAuthState).toHaveBeenCalledWith('user-123', 'facebook');
    });

    it('should redirect to error page on failure', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (createOAuthState as Mock).mockRejectedValue(new Error('State creation failed'));

      const request = new NextRequest('http://localhost:3000/api/social/connect/facebook', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('/settings/social-connections');
      expect(location).toContain('error=connect_failed');
    });
  });

  describe('GET /api/social/connect/instagram', () => {
    let GET: typeof import('@/app/api/social/connect/instagram/route').GET;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('@/app/api/social/connect/instagram/route');
      GET = module.GET;
    });

    it('should redirect to sign-in when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/social/connect/instagram', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('/sign-in');
      expect(location).toContain('error=unauthenticated');
    });

    it('should redirect to Instagram OAuth URL when authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (createOAuthState as Mock).mockResolvedValue('state-token');
      (buildInstagramAuthUrl as Mock).mockReturnValue(
        'https://api.instagram.com/oauth/authorize?client_id=instagram-app-id&redirect_uri=https%3A%2F%2Ftaruu.co.il%2Fapi%2Fsocial%2Fcallback%2Finstagram&state=state-token&scope=user_profile,user_media&response_type=code'
      );

      const request = new NextRequest('http://localhost:3000/api/social/connect/instagram', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('instagram.com');
      expect(location).toContain('oauth');
      expect(createOAuthState).toHaveBeenCalledWith('user-123', 'instagram');
    });

    it('should redirect to error page on failure', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (createOAuthState as Mock).mockRejectedValue(new Error('State creation failed'));

      const request = new NextRequest('http://localhost:3000/api/social/connect/instagram', {
        method: 'GET',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('Location');
      expect(location).toContain('/settings/social-connections');
      expect(location).toContain('error=connect_failed');
    });
  });
});
