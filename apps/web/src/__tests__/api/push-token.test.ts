/**
 * Push Token API Route Tests
 *
 * Tests for the /api/user/push-token endpoints:
 * - POST /api/user/push-token - Register push token
 * - GET /api/user/push-token - Get user's push tokens
 * - DELETE /api/user/push-token - Remove push token
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '@/app/api/user/push-token/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  upsertPushToken: vi.fn(),
  getPushTokensByUserId: vi.fn(),
  deletePushToken: vi.fn(),
  deactivatePushToken: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  upsertPushToken,
  getPushTokensByUserId,
  deletePushToken,
  deactivatePushToken,
} from '@/lib/supabase/db';

describe('Push Token API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockPushToken = {
    id: 'token-id-123',
    user_id: 'user-123',
    token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
    device_type: 'ios',
    device_name: 'iPhone 15',
    is_active: true,
    last_used: '2025-01-15T12:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/user/push-token', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'ExponentPushToken[xxx]',
          deviceType: 'ios',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when token is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({ deviceType: 'ios' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and deviceType are required');
    });

    it('should return 400 when deviceType is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({ token: 'ExponentPushToken[xxx]' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token and deviceType are required');
    });

    it('should return 400 for invalid token format', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid-token-format',
          deviceType: 'ios',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid Expo push token format');
    });

    it('should return 400 for invalid deviceType', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
          deviceType: 'windows',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('deviceType must be ios or android');
    });

    it('should register iOS push token successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (upsertPushToken as Mock).mockResolvedValue(mockPushToken);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
          deviceType: 'ios',
          deviceName: 'iPhone 15',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tokenId).toBe('token-id-123');
      expect(upsertPushToken).toHaveBeenCalledWith({
        user_id: 'user-123',
        token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
        device_type: 'ios',
        device_name: 'iPhone 15',
        is_active: true,
        last_used: expect.any(String),
      });
    });

    it('should register Android push token successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (upsertPushToken as Mock).mockResolvedValue({
        ...mockPushToken,
        device_type: 'android',
      });

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'ExponentPushToken[yyyyyyyyyyyyyyy]',
          deviceType: 'android',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (upsertPushToken as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'POST',
        body: JSON.stringify({
          token: 'ExponentPushToken[xxxxxxxxxxxxxx]',
          deviceType: 'ios',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to register push token');
    });
  });

  describe('GET /api/user/push-token', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array when no tokens exist', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPushTokensByUserId as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens).toEqual([]);
    });

    it('should return user push tokens', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPushTokensByUserId as Mock).mockResolvedValue([
        mockPushToken,
        { ...mockPushToken, id: 'token-id-456', device_type: 'android' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens).toHaveLength(2);
      expect(data.tokens[0].id).toBe('token-id-123');
      expect(data.tokens[0].deviceType).toBe('ios');
      expect(data.tokens[0].isActive).toBe(true);
      expect(data.tokens[1].deviceType).toBe('android');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPushTokensByUserId as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get push tokens');
    });
  });

  describe('DELETE /api/user/push-token', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/user/push-token?token=ExponentPushToken[xxx]',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when token is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/push-token', {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token is required as a query parameter');
    });

    it('should delete push token successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (deletePushToken as Mock).mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/user/push-token?token=ExponentPushToken[xxx]',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(deletePushToken).toHaveBeenCalledWith('user-123', 'ExponentPushToken[xxx]');
    });

    it('should deactivate push token when action=deactivate', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (deactivatePushToken as Mock).mockResolvedValue(undefined);

      const request = new NextRequest(
        'http://localhost:3000/api/user/push-token?token=ExponentPushToken[xxx]&action=deactivate',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(deactivatePushToken).toHaveBeenCalledWith('user-123', 'ExponentPushToken[xxx]');
      expect(deletePushToken).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (deletePushToken as Mock).mockRejectedValue(new Error('Delete failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/user/push-token?token=ExponentPushToken[xxx]',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete push token');
    });
  });
});
