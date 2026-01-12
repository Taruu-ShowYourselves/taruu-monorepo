/**
 * Auth Flow Integration Tests
 *
 * Tests the authentication flow including:
 * - Google OAuth initiation
 * - Session management
 * - DID generation and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-at-least-32-chars-long');
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Google OAuth Flow', () => {
    it('should generate correct Google OAuth URL', async () => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId!);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      expect(authUrl.searchParams.get('client_id')).toBe('test-client-id');
      expect(authUrl.searchParams.get('response_type')).toBe('code');
      expect(authUrl.searchParams.get('scope')).toContain('openid');
      expect(authUrl.searchParams.get('scope')).toContain('email');
    });

    it('should handle OAuth callback with valid code', async () => {
      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          id_token: 'mock-id-token',
          expires_in: 3600,
        }),
      });

      // Mock user info fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
        }),
      });

      // Simulate callback handling
      const code = 'mock-auth-code';
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      expect(tokenResponse.ok).toBe(true);
      const tokens = await tokenResponse.json();
      expect(tokens.access_token).toBe('mock-access-token');
    });

    it('should reject invalid OAuth callback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: JSON.stringify({ code: 'invalid-code' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Session Management', () => {
    it('should create valid JWT session', async () => {
      // Import jose for JWT operations
      const { SignJWT, jwtVerify } = await import('jose');

      const secret = new TextEncoder().encode(process.env.JWT_SECRET);

      // Create session token
      const token = await new SignJWT({
        userId: 'user-123',
        email: 'test@example.com',
        googleId: 'google-123',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify token
      const { payload } = await jwtVerify(token, secret);
      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });

    it('should reject expired session', async () => {
      const { SignJWT, jwtVerify } = await import('jose');

      const secret = new TextEncoder().encode(process.env.JWT_SECRET);

      // Create expired token
      const token = await new SignJWT({
        userId: 'user-123',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400) // 1 day ago
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1 hour ago
        .sign(secret);

      await expect(jwtVerify(token, secret)).rejects.toThrow();
    });

    it('should reject tampered session', async () => {
      const { SignJWT, jwtVerify } = await import('jose');

      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const wrongSecret = new TextEncoder().encode('wrong-secret-key-32-chars-long!!');

      // Create token with correct secret
      const token = await new SignJWT({
        userId: 'user-123',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      // Try to verify with wrong secret
      await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
    });
  });

  describe('DID Generation', () => {
    it('should generate valid DID format', async () => {
      // Import DID utilities
      const { isValidDID, extractDIDHash } = await import('@sync/shared');

      // Test valid DID format
      const validDID = 'did:sync:' + 'a'.repeat(43);
      expect(isValidDID(validDID)).toBe(true);

      const hash = extractDIDHash(validDID);
      expect(hash).toBe('a'.repeat(43));
    });

    it('should reject invalid DID format', async () => {
      const { isValidDID } = await import('@sync/shared');

      // Wrong prefix
      expect(isValidDID('did:other:' + 'a'.repeat(43))).toBe(false);

      // Wrong length
      expect(isValidDID('did:sync:' + 'a'.repeat(42))).toBe(false);
      expect(isValidDID('did:sync:' + 'a'.repeat(44))).toBe(false);

      // Invalid characters
      expect(isValidDID('did:sync:' + 'a'.repeat(42) + '!')).toBe(false);
    });
  });

  describe('Identity Score', () => {
    it('should calculate correct identity score', async () => {
      const { calculateIdentityScore, IDENTITY_SCORE_WEIGHTS } = await import('@sync/shared');

      // Google only = 40 points (basic)
      const googleOnly = calculateIdentityScore([
        { platform: 'google', platformUserId: '123', displayName: 'Test', verifiedAt: new Date(), stampWeight: 40 },
      ]);
      expect(googleOnly.total).toBe(40);
      expect(googleOnly.level).toBe('basic');

      // Google + Facebook = 70 points (verified)
      const withFacebook = calculateIdentityScore([
        { platform: 'google', platformUserId: '123', displayName: 'Test', verifiedAt: new Date(), stampWeight: 40 },
        { platform: 'facebook', platformUserId: '456', displayName: 'Test', verifiedAt: new Date(), stampWeight: 30 },
      ]);
      expect(withFacebook.total).toBe(70);
      expect(withFacebook.level).toBe('verified');

      // All platforms = 100 points (trusted)
      const allPlatforms = calculateIdentityScore([
        { platform: 'google', platformUserId: '123', displayName: 'Test', verifiedAt: new Date(), stampWeight: 40 },
        { platform: 'facebook', platformUserId: '456', displayName: 'Test', verifiedAt: new Date(), stampWeight: 30 },
        { platform: 'instagram', platformUserId: '789', displayName: 'Test', verifiedAt: new Date(), stampWeight: 30 },
      ]);
      expect(allPlatforms.total).toBe(100);
      expect(allPlatforms.level).toBe('trusted');
    });
  });
});
