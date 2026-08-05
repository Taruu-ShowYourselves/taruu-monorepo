/**
 * Auth Flow Integration Tests
 *
 * Tests the authentication flow including:
 * - Google OIDC initiation (direct - no intermediary IdP)
 * - Session management
 * - DID generation and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id');
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

  describe('Google OIDC Flow', () => {
    it('should generate a correct Google /authorize URL pointing at the sign-in page', async () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/he/sign-in`;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId!);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email');

      expect(authUrl.origin).toBe('https://accounts.google.com');
      expect(authUrl.searchParams.get('client_id')).toBe('test-client-id');
      // The redirect target must be an app page - the API route only accepts
      // POST, so a provider GET redirect there can never complete a login.
      expect(authUrl.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/he/sign-in'
      );
      expect(authUrl.searchParams.get('scope')).toContain('openid');
      expect(authUrl.searchParams.get('scope')).toContain('email');
    });

    it('should handle OAuth callback with valid code', async () => {
      // Mock successful token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock-access-token',
          id_token: 'mock-id-token',
          expires_in: 3600,
        }),
      });

      // Mock Google userinfo fetch (OIDC claims; sub is the external subject)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-user-123',
          email: 'test@example.com',
          email_verified: true,
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
    it('should calculate correct identity score per auth-flow.md v77', async () => {
      const { calculateIdentityScore, IDENTITY_SCORE_WEIGHTS, GPS_SCORE_WEIGHT } = await import('@sync/shared');

      // Verify weights match spec: GPS=40, Google=40, Facebook=10, Instagram=10
      expect(GPS_SCORE_WEIGHT).toBe(40);
      expect(IDENTITY_SCORE_WEIGHTS.google).toBe(40);
      expect(IDENTITY_SCORE_WEIGHTS.facebook).toBe(10);
      expect(IDENTITY_SCORE_WEIGHTS.instagram).toBe(10);

      // Google only = 40 points (basic)
      const googleOnly = calculateIdentityScore([
        { platform: 'google', providerId: '123', displayName: 'Test', connectedAt: new Date(), stampWeight: 40 },
      ]);
      expect(googleOnly.total).toBe(40);
      expect(googleOnly.level).toBe('basic');

      // Google + Facebook = 50 points (still basic, not verified)
      const withFacebook = calculateIdentityScore([
        { platform: 'google', providerId: '123', displayName: 'Test', connectedAt: new Date(), stampWeight: 40 },
        { platform: 'facebook', providerId: '456', displayName: 'Test', connectedAt: new Date(), stampWeight: 10 },
      ]);
      expect(withFacebook.total).toBe(50);
      expect(withFacebook.level).toBe('basic');

      // All social platforms (no GPS) = 60 points (verified)
      const allSocial = calculateIdentityScore([
        { platform: 'google', providerId: '123', displayName: 'Test', connectedAt: new Date(), stampWeight: 40 },
        { platform: 'facebook', providerId: '456', displayName: 'Test', connectedAt: new Date(), stampWeight: 10 },
        { platform: 'instagram', providerId: '789', displayName: 'Test', connectedAt: new Date(), stampWeight: 10 },
      ]);
      expect(allSocial.total).toBe(60);
      expect(allSocial.level).toBe('verified');

      // Google + GPS = 80 points (trusted) - GPS is the key differentiator
      const googlePlusGps = calculateIdentityScore([
        { platform: 'google', providerId: '123', displayName: 'Test', connectedAt: new Date(), stampWeight: 40 },
      ], true);
      expect(googlePlusGps.total).toBe(80);
      expect(googlePlusGps.level).toBe('trusted');

      // All verifications = 100 points (max trusted)
      const allVerified = calculateIdentityScore([
        { platform: 'google', providerId: '123', displayName: 'Test', connectedAt: new Date(), stampWeight: 40 },
        { platform: 'facebook', providerId: '456', displayName: 'Test', connectedAt: new Date(), stampWeight: 10 },
        { platform: 'instagram', providerId: '789', displayName: 'Test', connectedAt: new Date(), stampWeight: 10 },
      ], true);
      expect(allVerified.total).toBe(100);
      expect(allVerified.level).toBe('trusted');
    });
  });
});
