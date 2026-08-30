/**
 * Verification API Route Tests
 *
 * Tests for the /api/verification endpoints:
 * - POST /api/verification/start - Start 21-day verification
 * - GET /api/verification/status - Get verification status
 * - GET /api/verification/schedule - Get check-in schedule
 * - POST /api/verification/check-in - Perform GPS check-in
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as StartVerification } from '@/app/api/verification/start/route';
import { GET as GetStatus } from '@/app/api/verification/status/route';
import { GET as GetSchedule } from '@/app/api/verification/schedule/route';
import { POST as CheckIn } from '@/app/api/verification/check-in/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getUserByGoogleId: vi.fn(),
  getActiveVerificationRun: vi.fn(),
  createVerificationRun: vi.fn(),
  createVerificationScheduleItems: vi.fn(),
  updateUser: vi.fn(),
  getVerificationSchedule: vi.fn(),
  getNextPendingCheckIn: vi.fn(),
  createVerificationAttempt: vi.fn(),
  updateVerificationRun: vi.fn(),
  updateVerificationScheduleItem: vi.fn(),
}));

// Mock municipality service
vi.mock('@/services/verification/municipality', () => ({
  getMunicipalityBounds: vi.fn(),
  isPointInMunicipality: vi.fn(),
  verifyCheckIn: vi.fn(),
}));

// Mock rate limiter (async check method)
vi.mock('@/lib/rate-limit', () => ({
  verificationCheckInLimiter: {
    check: vi.fn(() => Promise.resolve({ limited: false })),
  },
  createRateLimitResponse: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getUserByGoogleId,
  getActiveVerificationRun,
  createVerificationRun,
  createVerificationScheduleItems,
  updateUser,
  getVerificationSchedule,
  getNextPendingCheckIn,
  createVerificationAttempt,
  updateVerificationScheduleItem,
  updateVerificationRun,
} from '@/lib/supabase/db';
import { getMunicipalityBounds, verifyCheckIn } from '@/services/verification/municipality';
import { verificationCheckInLimiter, createRateLimitResponse } from '@/lib/rate-limit';

describe('Verification API Routes', () => {
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
    municipality_id: 'tel-aviv',
    verification_status: 'none',
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockVerificationRun = {
    id: 'run-123',
    user_id: 'user-123',
    municipality_id: 'tel-aviv',
    status: 'active',
    total_check_ins: 6,
    completed_check_ins: 0,
    failed_check_ins: 0,
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/verification/start', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 when no municipality selected', async () => {
      const userWithoutMunicipality = { ...mockUser, municipality_id: null };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(userWithoutMunicipality);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('select a municipality');
    });

    it('should return 400 when municipality is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getMunicipalityBounds as Mock).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid municipality selected');
    });

    it('should return 400 when verification already in progress', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getMunicipalityBounds as Mock).mockReturnValue({ /* polygon bounds */ });
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Verification is already in progress');
    });

    it('should return 400 when user already verified', async () => {
      const verifiedUser = { ...mockUser, verification_status: 'verified' };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(verifiedUser);
      (getMunicipalityBounds as Mock).mockReturnValue({ /* polygon bounds */ });
      (getActiveVerificationRun as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already completed');
    });

    it('should start verification successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getMunicipalityBounds as Mock).mockReturnValue({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
      });
      (getActiveVerificationRun as Mock).mockResolvedValue(null);
      (createVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (createVerificationScheduleItems as Mock).mockResolvedValue([
        { id: 'schedule-1', window_start: '2025-01-17T10:00:00Z', window_end: '2025-01-17T10:30:00Z' },
      ]);
      (updateUser as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.schedule).toBeDefined();
      expect(data.schedule.id).toBe('run-123');
      expect(data.schedule.municipality).toBe('tel-aviv');
      expect(data.schedule.totalCheckIns).toBeGreaterThanOrEqual(5);
      expect(data.schedule.totalCheckIns).toBeLessThanOrEqual(7);
      expect(data.verificationStatus.phase).toBe('in_progress');
      expect(createVerificationRun).toHaveBeenCalled();
      expect(createVerificationScheduleItems).toHaveBeenCalled();
      // Every window must name both the run and the resident. `user_id` is
      // denormalised onto the schedule so migration 20260904000008 can anchor
      // `(run_id, user_id)` to the run that owns it; the column is NOT NULL, so
      // a window built without it fails the insert in production while a test
      // that only asserts "was called" stays green.
      const [submittedWindows] = (createVerificationScheduleItems as Mock).mock.calls[0];
      expect(submittedWindows.length).toBeGreaterThan(0);
      for (const window of submittedWindows) {
        expect(window.run_id).toBe(mockVerificationRun.id);
        expect(window.user_id).toBe(mockVerificationRun.user_id);
      }
      expect(updateUser).toHaveBeenCalledWith(mockUser.id, { verification_status: 'pending' });
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getMunicipalityBounds as Mock).mockReturnValue({ /* polygon bounds */ });
      (getActiveVerificationRun as Mock).mockResolvedValue(null);
      (createVerificationRun as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/verification/start', {
        method: 'POST',
      });
      const response = await StartVerification(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to start verification');
    });
  });

  describe('GET /api/verification/status', () => {
    const mockScheduleItems = [
      {
        id: 'schedule-1',
        verification_run_id: 'run-123',
        window_start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        window_end: new Date(Date.now() + 86400000 + 1800000).toISOString(),
        completed: false,
      },
      {
        id: 'schedule-2',
        verification_run_id: 'run-123',
        window_start: new Date(Date.now() + 86400000 * 3).toISOString(), // In 3 days
        window_end: new Date(Date.now() + 86400000 * 3 + 1800000).toISOString(),
        completed: false,
      },
    ];

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return not_started when no active run and user not verified', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus.phase).toBe('not_started');
    });

    it('should return completed when user is verified', async () => {
      const verifiedUser = { ...mockUser, verification_status: 'verified' };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(verifiedUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus.phase).toBe('completed');
    });

    it('should return in_progress with schedule data', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getVerificationSchedule as Mock).mockResolvedValue(mockScheduleItems);

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus.phase).toBe('in_progress');
      expect(data.progress).toBeDefined();
      expect(data.progress.totalCheckIns).toBe(2);
      expect(data.municipality).toBe('tel-aviv');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/verification/status');
      const response = await GetStatus(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch verification status');
    });
  });

  describe('GET /api/verification/schedule', () => {
    const mockScheduleItems = [
      {
        id: 'schedule-1',
        verification_run_id: 'run-123',
        window_start: new Date(Date.now() + 86400000).toISOString(),
        window_end: new Date(Date.now() + 86400000 + 1800000).toISOString(),
        completed: false,
      },
    ];

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/schedule');
      const response = await GetSchedule(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/schedule');
      const response = await GetSchedule(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 404 when no verification in progress', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/schedule');
      const response = await GetSchedule(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No verification in progress');
    });

    it('should return schedule successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getVerificationSchedule as Mock).mockResolvedValue(mockScheduleItems);

      const request = new NextRequest('http://localhost:3000/api/verification/schedule');
      const response = await GetSchedule(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.schedule).toBeDefined();
      expect(data.schedule.id).toBe('run-123');
      expect(data.schedule.municipality).toBe('tel-aviv');
      expect(data.schedule.completedCheckIns).toBe(0);
      expect(data.schedule.nextCheckIn).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/verification/schedule');
      const response = await GetSchedule(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/verification/check-in', () => {
    const now = new Date();
    const mockScheduleItem = {
      id: 'schedule-1',
      verification_run_id: 'run-123',
      window_start: new Date(now.getTime() - 300000).toISOString(), // 5 minutes ago
      window_end: new Date(now.getTime() + 1500000).toISOString(), // 25 minutes from now
      completed: false,
    };

    const validCheckInData = {
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy: 10,
    };

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: true, remaining: 0 });
      (createRateLimitResponse as Mock).mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
      );

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);

      expect(response.status).toBe(429);
    });

    it('should return 400 when coordinates are invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify({ latitude: 'invalid', longitude: 34.7818 }),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid coordinates provided');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 when no verification in progress', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No verification in progress');
    });

    it('should return 400 when no pending check-in found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getNextPendingCheckIn as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No pending check-in found');
    });

    it('should return 400 when check-in window has not started', async () => {
      const futureWindow = {
        ...mockScheduleItem,
        window_start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        window_end: new Date(Date.now() + 86400000 + 1800000).toISOString(),
      };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getNextPendingCheckIn as Mock).mockResolvedValue(futureWindow);
      (createVerificationAttempt as Mock).mockResolvedValue({ id: 'attempt-1' });

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not started yet');
    });

    it('should return 400 when check-in window has expired', async () => {
      const expiredWindow = {
        ...mockScheduleItem,
        window_start: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        window_end: new Date(Date.now() - 86400000 + 1800000).toISOString(),
      };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getNextPendingCheckIn as Mock).mockResolvedValue(expiredWindow);
      (createVerificationAttempt as Mock).mockResolvedValue({ id: 'attempt-1' });

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('expired');
    });

    it('should return 400 when GPS location fails verification', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getNextPendingCheckIn as Mock).mockResolvedValue(mockScheduleItem);
      (verifyCheckIn as Mock).mockReturnValue({
        verified: false,
        error: 'Location is outside municipality',
        inMunicipality: false,
        accuracyAcceptable: true,
        distanceFromCenter: 15000,
      });
      (createVerificationAttempt as Mock).mockResolvedValue({ id: 'attempt-1' });
      (updateVerificationRun as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.verified).toBe(false);
      expect(data.error).toContain('outside municipality');
    });

    it('should successfully record check-in', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getActiveVerificationRun as Mock).mockResolvedValue(mockVerificationRun);
      (getNextPendingCheckIn as Mock).mockResolvedValue(mockScheduleItem);
      (verifyCheckIn as Mock).mockReturnValue({
        verified: true,
        inMunicipality: true,
        accuracyAcceptable: true,
        distanceFromCenter: 500,
      });
      (createVerificationAttempt as Mock).mockResolvedValue({
        id: 'attempt-1',
        timestamp: new Date().toISOString(),
      });
      (updateVerificationScheduleItem as Mock).mockResolvedValue(undefined);
      (updateVerificationRun as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.verified).toBe(true);
      expect(data.checkIn).toBeDefined();
      expect(data.verificationStatus).toBeDefined();
      expect(createVerificationAttempt).toHaveBeenCalledWith(expect.objectContaining({
        schedule_id: 'schedule-1',
        user_id: 'user-123',
        latitude: 32.0853,
        longitude: 34.7818,
        passed: true,
      }));
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verificationCheckInLimiter.check as Mock).mockResolvedValue({ limited: false });
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/verification/check-in', {
        method: 'POST',
        body: JSON.stringify(validCheckInData),
      });
      const response = await CheckIn(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process check-in');
    });
  });
});
