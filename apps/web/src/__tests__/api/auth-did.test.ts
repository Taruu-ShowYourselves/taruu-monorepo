/**
 * Auth DID API Route Tests
 *
 * Tests for the /api/auth/did endpoint:
 * - GET /api/auth/did - Get existing DID
 * - POST /api/auth/did - Generate or recover DID
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock DID utils
vi.mock('@sync/shared', () => ({
  generateEncryptedDID: vi.fn(),
  recoverPrivateKey: vi.fn(),
  verifyDID: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserById, updateUser } from '@/lib/supabase/db';
import { generateEncryptedDID, recoverPrivateKey, verifyDID } from '@sync/shared';

describe('Auth DID API Routes', () => {
  let GET: typeof import('@/app/api/auth/did/route').GET;
  let POST: typeof import('@/app/api/auth/did/route').POST;

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
    did: 'did:sync:' + 'a'.repeat(43),
    did_public_key: JSON.stringify({ x: 'pub-x', y: 'pub-y' }),
    did_encrypted_private_key: JSON.stringify({
      encryptedPrivateKey: 'encrypted-key',
      salt: 'salt',
      iv: 'iv',
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/app/api/auth/did/route');
    GET = module.GET;
    POST = module.POST;
  });

  describe('GET /api/auth/did', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 404 when user has no DID', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, did: null });

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No DID generated for this user');
    });

    it('should return DID and public key successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.did).toBe(mockUser.did);
      expect(data.publicKey).toEqual({ x: 'pub-x', y: 'pub-y' });
    });
  });

  describe('POST /api/auth/did', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when oauthToken is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('OAuth token required for DID operations');
    });

    it('should return 400 when action is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action. Use "generate" or "recover"');
    });

    it('should return 409 when user already has DID', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('User already has a DID');
      expect(data.did).toBe(mockUser.did);
    });

    it('should generate new DID successfully', async () => {
      const newDID = 'did:sync:' + 'b'.repeat(43);
      const mockDIDData = {
        did: newDID,
        publicKey: { x: 'new-pub-x', y: 'new-pub-y' },
        encryptedPrivateKey: 'new-encrypted-key',
        salt: 'new-salt',
        iv: 'new-iv',
      };

      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, did: null });
      (generateEncryptedDID as Mock).mockResolvedValue(mockDIDData);
      (updateUser as Mock).mockResolvedValue({ ...mockUser, did: newDID });

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.did).toBe(newDID);
      expect(data.publicKey).toEqual({ x: 'new-pub-x', y: 'new-pub-y' });
      expect(updateUser).toHaveBeenCalled();
    });

    it('should recover DID successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (recoverPrivateKey as Mock).mockResolvedValue('decrypted-private-key');
      (verifyDID as Mock).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'recover', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.did).toBe(mockUser.did);
      expect(data.privateKey).toBe('decrypted-private-key');
      expect(data.message).toBe('DID recovered successfully');
    });

    it('should return 404 when recovering without DID', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, did: null, did_encrypted_private_key: null });

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'recover', oauthToken: 'token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No DID found for recovery');
    });

    it('should handle recovery failure', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (recoverPrivateKey as Mock).mockRejectedValue(new Error('Decryption failed'));

      const request = new NextRequest('http://localhost:3000/api/auth/did', {
        method: 'POST',
        body: JSON.stringify({ action: 'recover', oauthToken: 'wrong-token' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Recovery failed - token may have changed');
    });
  });
});
