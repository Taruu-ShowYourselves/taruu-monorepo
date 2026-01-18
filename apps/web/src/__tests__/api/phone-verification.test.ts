/**
 * Phone Verification API Route Tests
 *
 * Tests for the /api/user/phone endpoints:
 * - POST /api/user/phone/send-code - Send verification SMS
 * - POST /api/user/phone/verify - Verify SMS code
 * - GET /api/user/phone/status - Get verification status
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendCode } from '@/app/api/user/phone/send-code/route';
import { POST as verifyCode } from '@/app/api/user/phone/verify/route';
import { GET as getStatus } from '@/app/api/user/phone/status/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
}));

// Mock Twilio SMS service
vi.mock('@/services/sms/twilio', () => ({
  isSmsServiceConfigured: vi.fn(),
  sendVerificationCode: vi.fn(),
  checkVerificationCode: vi.fn(),
  getCodeExpirySeconds: vi.fn(() => 600),
}));

// Mock Supabase admin client
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate, insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserByGoogleId } from '@/lib/supabase/db';
import { isSmsServiceConfigured, sendVerificationCode, checkVerificationCode } from '@/services/sms/twilio';

describe('Phone Verification API Routes', () => {
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
    phone: null,
    phone_verified: false,
    phone_verified_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (isSmsServiceConfigured as Mock).mockReturnValue(true);
    mockSingle.mockReset();
    mockEq.mockReset().mockImplementation(() => ({ single: mockSingle }));
    mockSelect.mockReset().mockImplementation(() => ({ eq: mockEq }));
    mockUpdateEq.mockReset().mockImplementation(() => Promise.resolve({ error: null }));
    mockUpdate.mockReset().mockImplementation(() => ({ eq: mockUpdateEq }));
    mockInsert.mockReset().mockImplementation(() => Promise.resolve({ error: null }));
    mockFrom.mockReset().mockImplementation(() => ({ select: mockSelect, update: mockUpdate, insert: mockInsert }));
  });

  describe('POST /api/user/phone/send-code', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '0501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 503 when SMS service is not configured', async () => {
      (isSmsServiceConfigured as Mock).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '0501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('SMS_SEND_FAILED');
      expect(data.message).toBe('SMS service is not available');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '0501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 for invalid phone format', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: 'invalid' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_PHONE');
    });

    it('should return 400 for non-Israeli phone number', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '+14155551234' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('should normalize and send code for local format phone', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({ data: null, error: null });
      (sendVerificationCode as Mock).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '050-123-4567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(sendVerificationCode).toHaveBeenCalledWith('+972501234567');
    });

    it('should send code for E.164 format phone', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({ data: null, error: null });
      (sendVerificationCode as Mock).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.expiresIn).toBe(600);
    });

    it('should return 429 when hourly rate limit exceeded', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          send_attempts: 3,
          last_send_at: new Date().toISOString(), // Just sent
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('RATE_LIMITED');
      expect(data.retryAfter).toBeGreaterThan(0);
    });

    it('should return 429 when daily rate limit exceeded', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          send_attempts: 5,
          last_send_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('RATE_LIMITED');
    });

    it('should handle SMS send failure', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({ data: null, error: null });
      (sendVerificationCode as Mock).mockResolvedValue({ success: false, error: 'SMS_SEND_FAILED' });

      const request = new NextRequest('http://localhost:3000/api/user/phone/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567' }),
      });
      const response = await sendCode(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/user/phone/verify', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 503 when SMS service is not configured', async () => {
      (isSmsServiceConfigured as Mock).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('SMS_SEND_FAILED');
    });

    it('should return 400 for invalid code format', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: 'abc' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_CODE');
    });

    it('should return 400 for code that is not 6 digits', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '12345' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_CODE');
    });

    it('should return 400 when no pending verification', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('NO_PENDING_VERIFICATION');
    });

    it('should return 429 when verification rate limit exceeded', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          attempts: 5,
          last_attempt_at: new Date().toISOString(),
          last_send_at: new Date().toISOString(),
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('RATE_LIMITED');
      expect(data.retryAfter).toBeGreaterThan(0);
    });

    it('should return 400 for wrong verification code', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          attempts: 1,
          last_attempt_at: null,
          last_send_at: new Date().toISOString(),
        },
        error: null,
      });
      (checkVerificationCode as Mock).mockResolvedValue({ verified: false, error: 'WRONG_CODE' });

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('WRONG_CODE');
    });

    it('should verify phone successfully with correct code', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          attempts: 1,
          last_attempt_at: null,
          last_send_at: new Date().toISOString(),
        },
        error: null,
      });
      (checkVerificationCode as Mock).mockResolvedValue({ verified: true });

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.verified).toBe(true);
    });

    it('should reset attempt counter after 10 minutes', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      mockSingle.mockResolvedValue({
        data: {
          attempts: 4,
          last_attempt_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
          last_send_at: new Date().toISOString(),
        },
        error: null,
      });
      (checkVerificationCode as Mock).mockResolvedValue({ verified: true });

      const request = new NextRequest('http://localhost:3000/api/user/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '+972501234567', code: '123456' }),
      });
      const response = await verifyCode(request);

      // Should not be rate limited since 15 minutes passed
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/user/phone/status', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/phone/status');
      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/phone/status');
      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return unverified status for user without phone', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/phone/status');
      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
      expect(data.phone).toBeNull();
      expect(data.verifiedAt).toBeNull();
    });

    it('should return verified status for user with verified phone', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue({
        ...mockUser,
        phone: '+972501234567',
        phone_verified: true,
        phone_verified_at: '2025-01-15T12:00:00Z',
      });

      const request = new NextRequest('http://localhost:3000/api/user/phone/status');
      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.phone).toBe('+972501234567');
      expect(data.verifiedAt).toBe('2025-01-15T12:00:00Z');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/phone/status');
      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
