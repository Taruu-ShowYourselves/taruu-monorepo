/**
 * Cron Verification Notifications API Route Tests
 *
 * Tests for the /api/cron/verification-notifications endpoints:
 * - POST /api/cron/verification-notifications - Send check-in reminders
 * - GET /api/cron/verification-notifications - Health check
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUpcomingReminders: vi.fn(),
  updateVerificationScheduleItem: vi.fn(),
  getActiveUserPushTokens: vi.fn(),
  updatePushTokenLastUsed: vi.fn(),
}));

// Mock notification service
vi.mock('@/services/notifications/expo', () => ({
  sendCheckInReminder: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import {
  getUpcomingReminders,
  updateVerificationScheduleItem,
  getActiveUserPushTokens,
  updatePushTokenLastUsed,
} from '@/lib/supabase/db';
import { sendCheckInReminder } from '@/services/notifications/expo';
import { cronLogger as log } from '@/lib/logger';

describe('Cron Verification Notifications API Routes', () => {
  const originalEnv = process.env;

  // POST and GET functions - will be imported fresh in beforeEach
  let POST: typeof import('@/app/api/cron/verification-notifications/route').POST;
  let GET: typeof import('@/app/api/cron/verification-notifications/route').GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-cron-secret',
    };
    // Re-import module to pick up fresh env and mocks
    vi.resetModules();
    const module = await import('@/app/api/cron/verification-notifications/route');
    POST = module.POST;
    GET = module.GET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/cron/verification-notifications', () => {
    it('should return health check status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('verification-notifications');
      expect(data.description).toBeDefined();
    });
  });

  describe('POST /api/cron/verification-notifications', () => {
    it('should return 503 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      // Re-import to pick up new env
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/cron/verification-notifications/route');

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer some-token',
        },
      });
      const response = await POST2(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Cron endpoint not configured');
    });

    it('should return 401 when authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer wrong-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should process reminders successfully with no pending reminders', async () => {
      // Re-get mock since module was reset
      const { getUpcomingReminders: mockGetReminders } = await import('@/lib/supabase/db');
      (mockGetReminders as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.remindersProcessed).toBe(0);
      expect(data.results.notificationsSent).toBe(0);
    });

    it('should send notifications to users with push tokens', async () => {
      const mockReminder = {
        schedule: {
          id: 'schedule-123',
          window_start: '2025-01-15T14:30:00Z',
        },
        run: {
          municipality_id: 'tel-aviv',
          completed_check_ins: 2,
          failed_check_ins: 0,
          total_check_ins: 6,
        },
        user: {
          id: 'user-123',
        },
      };

      // Re-get mocks since module was reset
      const db = await import('@/lib/supabase/db');
      const notifications = await import('@/services/notifications/expo');
      (db.getUpcomingReminders as Mock).mockResolvedValue([mockReminder]);
      (db.getActiveUserPushTokens as Mock).mockResolvedValue(['ExponentPushToken[xxx]']);
      (notifications.sendCheckInReminder as Mock).mockResolvedValue({ success: true });
      (db.updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);
      (db.updatePushTokenLastUsed as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.remindersProcessed).toBe(1);
      expect(data.results.notificationsSent).toBe(1);
      expect(notifications.sendCheckInReminder).toHaveBeenCalledWith('ExponentPushToken[xxx]', {
        scheduledTime: '2025-01-15T14:30:00Z',
        municipality: 'tel-aviv',
        checkInNumber: 3,
        totalCheckIns: 6,
      });
      expect(db.updateVerificationScheduleItem).toHaveBeenCalledWith('schedule-123', {
        reminder_sent: true,
      });
    });

    it('should mark reminder as sent even if user has no push tokens', async () => {
      const mockReminder = {
        schedule: { id: 'schedule-123', window_start: '2025-01-15T14:30:00Z' },
        run: { municipality_id: 'tel-aviv', completed_check_ins: 0, failed_check_ins: 0, total_check_ins: 6 },
        user: { id: 'user-456' },
      };

      const db = await import('@/lib/supabase/db');
      const notifications = await import('@/services/notifications/expo');
      (db.getUpcomingReminders as Mock).mockResolvedValue([mockReminder]);
      (db.getActiveUserPushTokens as Mock).mockResolvedValue([]);
      (db.updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.remindersProcessed).toBe(1);
      expect(data.results.usersWithoutTokens).toBe(1);
      expect(data.results.notificationsSent).toBe(0);
      expect(db.updateVerificationScheduleItem).toHaveBeenCalledWith('schedule-123', {
        reminder_sent: true,
      });
      expect(notifications.sendCheckInReminder).not.toHaveBeenCalled();
    });

    it('should track failed notifications', async () => {
      const mockReminder = {
        schedule: { id: 'schedule-123', window_start: '2025-01-15T14:30:00Z' },
        run: { municipality_id: 'tel-aviv', completed_check_ins: 0, failed_check_ins: 0, total_check_ins: 6 },
        user: { id: 'user-123' },
      };

      const db = await import('@/lib/supabase/db');
      const notifications = await import('@/services/notifications/expo');
      (db.getUpcomingReminders as Mock).mockResolvedValue([mockReminder]);
      (db.getActiveUserPushTokens as Mock).mockResolvedValue(['ExponentPushToken[xxx]']);
      (notifications.sendCheckInReminder as Mock).mockResolvedValue({ success: false, error: 'Push service unavailable' });
      (db.updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.notificationsFailed).toBe(1);
      expect(data.results.errors).toHaveLength(1);
      expect(data.results.errors[0]).toContain('Failed to send to user');
    });

    it('should handle multiple users and tokens', async () => {
      const mockReminders = [
        {
          schedule: { id: 'schedule-1', window_start: '2025-01-15T14:30:00Z' },
          run: { municipality_id: 'tel-aviv', completed_check_ins: 1, failed_check_ins: 0, total_check_ins: 6 },
          user: { id: 'user-1' },
        },
        {
          schedule: { id: 'schedule-2', window_start: '2025-01-15T15:00:00Z' },
          run: { municipality_id: 'haifa', completed_check_ins: 3, failed_check_ins: 1, total_check_ins: 6 },
          user: { id: 'user-2' },
        },
      ];

      const db = await import('@/lib/supabase/db');
      const notifications = await import('@/services/notifications/expo');
      (db.getUpcomingReminders as Mock).mockResolvedValue(mockReminders);
      (db.getActiveUserPushTokens as Mock)
        .mockResolvedValueOnce(['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'])
        .mockResolvedValueOnce(['ExponentPushToken[ccc]']);
      (notifications.sendCheckInReminder as Mock).mockResolvedValue({ success: true });
      (db.updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);
      (db.updatePushTokenLastUsed as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.remindersProcessed).toBe(2);
      expect(data.results.notificationsSent).toBe(3);
      expect(notifications.sendCheckInReminder).toHaveBeenCalledTimes(3);
    });

    it('should handle errors in individual reminders without failing entire job', async () => {
      const mockReminders = [
        {
          schedule: { id: 'schedule-1', window_start: '2025-01-15T14:30:00Z' },
          run: { municipality_id: 'tel-aviv', completed_check_ins: 0, failed_check_ins: 0, total_check_ins: 6 },
          user: { id: 'user-1' },
        },
        {
          schedule: { id: 'schedule-2', window_start: '2025-01-15T15:00:00Z' },
          run: { municipality_id: 'haifa', completed_check_ins: 0, failed_check_ins: 0, total_check_ins: 6 },
          user: { id: 'user-2' },
        },
      ];

      const db = await import('@/lib/supabase/db');
      const notifications = await import('@/services/notifications/expo');
      (db.getUpcomingReminders as Mock).mockResolvedValue(mockReminders);
      (db.getActiveUserPushTokens as Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(['ExponentPushToken[xxx]']);
      (notifications.sendCheckInReminder as Mock).mockResolvedValue({ success: true });
      (db.updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);
      (db.updatePushTokenLastUsed as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.remindersProcessed).toBe(2);
      expect(data.results.notificationsSent).toBe(1);
      expect(data.results.errors).toHaveLength(1);
      expect(data.results.errors[0]).toContain('schedule-1');
    });

    it('should handle database errors in getUpcomingReminders gracefully', async () => {
      const db = await import('@/lib/supabase/db');
      (db.getUpcomingReminders as Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/cron/verification-notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toBe('Database connection failed');
    });
  });
});
