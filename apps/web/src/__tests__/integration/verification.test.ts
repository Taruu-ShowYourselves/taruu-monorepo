/**
 * Verification Schedule Integration Tests
 *
 * Tests the 21-day GPS verification flow including:
 * - Schedule generation with random check-ins
 * - Check-in window management
 * - Completion and failure scenarios
 * - Progress calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import verification schedule functions
import {
  generateVerificationSchedule,
  getNextCheckIn,
  isCheckInActive,
  completeCheckIn,
  missCheckIn,
  processExpiredCheckIns,
  calculateVerificationResult,
  finalizeSchedule,
  createVerificationStatus,
  getScheduleProgress,
} from '@/services/verification/schedule';

import type { VerificationSchedule, ScheduledCheckIn } from '@sync/shared';

describe('Verification Schedule Integration', () => {
  describe('Schedule Generation', () => {
    it('should generate a valid 21-day schedule', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');

      expect(schedule.id).toBeDefined();
      expect(schedule.userId).toBe('user-123');
      expect(schedule.municipality).toBe('tel-aviv');
      expect(schedule.status).toBe('active');
      expect(schedule.completedCheckIns).toBe(0);

      // Check period is 21 days
      const periodStart = new Date(schedule.periodStart);
      const periodEnd = new Date(schedule.periodEnd);
      const diffDays = Math.round(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(21);
    });

    it('should generate 5-7 random check-ins', () => {
      // Test multiple times to account for randomness
      for (let i = 0; i < 10; i++) {
        const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
        const checkInCount = schedule.scheduledCheckIns.length;
        expect(checkInCount).toBeGreaterThanOrEqual(5);
        expect(checkInCount).toBeLessThanOrEqual(7);
      }
    });

    it('should distribute check-ins on different days', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const checkInDays = schedule.scheduledCheckIns.map((c) => {
        const date = new Date(c.scheduledAt);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      });

      // All days should be unique
      const uniqueDays = new Set(checkInDays);
      expect(uniqueDays.size).toBe(checkInDays.length);
    });

    it('should schedule check-ins within working hours (8 AM - 10 PM)', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');

      for (const checkIn of schedule.scheduledCheckIns) {
        const hour = new Date(checkIn.scheduledAt).getHours();
        expect(hour).toBeGreaterThanOrEqual(8);
        expect(hour).toBeLessThan(22);
      }
    });

    it('should set 30-minute check-in window', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');

      for (const checkIn of schedule.scheduledCheckIns) {
        const windowStart = new Date(checkIn.windowStart);
        const windowEnd = new Date(checkIn.windowEnd);
        const diffMinutes = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60);
        expect(diffMinutes).toBe(30);
      }
    });

    it('should initialize all check-ins as pending', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');

      for (const checkIn of schedule.scheduledCheckIns) {
        expect(checkIn.status).toBe('pending');
        expect(checkIn.completedAt).toBeUndefined();
        expect(checkIn.location).toBeUndefined();
      }
    });
  });

  describe('Check-In Window Management', () => {
    it('should find the next pending check-in', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const nextCheckIn = getNextCheckIn(schedule);

      expect(nextCheckIn).not.toBeNull();
      expect(nextCheckIn?.status).toBe('pending');
    });

    it('should identify active check-in window correctly', () => {
      // Create a check-in that's currently active
      const now = new Date();
      const activeCheckIn: ScheduledCheckIn = {
        id: 'test-1',
        scheduledAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 min ago
        windowStart: new Date(now.getTime() - 10 * 60 * 1000),
        windowEnd: new Date(now.getTime() + 20 * 60 * 1000), // 20 min from now
        status: 'pending',
      };

      expect(isCheckInActive(activeCheckIn)).toBe(true);
    });

    it('should reject check-in outside window', () => {
      const now = new Date();
      const expiredCheckIn: ScheduledCheckIn = {
        id: 'test-1',
        scheduledAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        windowStart: new Date(now.getTime() - 60 * 60 * 1000),
        windowEnd: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
        status: 'pending',
      };

      expect(isCheckInActive(expiredCheckIn)).toBe(false);
    });
  });

  describe('Check-In Completion', () => {
    it('should mark check-in as completed with location', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const checkInId = schedule.scheduledCheckIns[0].id;

      const location = {
        latitude: 32.0853,
        longitude: 34.7818,
        accuracy: 10,
      };

      const updated = completeCheckIn(schedule, checkInId, location, true);

      const completedCheckIn = updated.scheduledCheckIns.find(
        (c) => c.id === checkInId
      );
      expect(completedCheckIn?.status).toBe('completed');
      expect(completedCheckIn?.location?.latitude).toBe(32.0853);
      expect(completedCheckIn?.location?.longitude).toBe(34.7818);
      expect(completedCheckIn?.municipalityVerified).toBe(true);
      expect(completedCheckIn?.completedAt).toBeDefined();
      expect(updated.completedCheckIns).toBe(1);
    });

    it('should increment completed count on each completion', () => {
      let schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const location = { latitude: 32.0853, longitude: 34.7818 };

      // Complete first three check-ins
      for (let i = 0; i < 3; i++) {
        const checkInId = schedule.scheduledCheckIns[i].id;
        schedule = completeCheckIn(schedule, checkInId, location, true);
        expect(schedule.completedCheckIns).toBe(i + 1);
      }
    });

    it('should mark check-in as missed', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const checkInId = schedule.scheduledCheckIns[0].id;

      const updated = missCheckIn(schedule, checkInId);

      const missedCheckIn = updated.scheduledCheckIns.find(
        (c) => c.id === checkInId
      );
      expect(missedCheckIn?.status).toBe('missed');
    });
  });

  describe('Expired Check-In Processing', () => {
    it('should mark expired check-ins as missed', () => {
      // Create schedule with past check-ins
      const now = new Date();
      const pastSchedule: VerificationSchedule = {
        id: 'test-schedule',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          {
            id: 'past-1',
            scheduledAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            windowStart: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            windowEnd: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
            status: 'pending',
          },
          {
            id: 'future-1',
            scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            windowStart: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            windowEnd: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
            status: 'pending',
          },
        ],
        status: 'active',
        completedCheckIns: 0,
        createdAt: now,
        updatedAt: now,
      };

      const processed = processExpiredCheckIns(pastSchedule);

      const pastCheckIn = processed.scheduledCheckIns.find((c) => c.id === 'past-1');
      const futureCheckIn = processed.scheduledCheckIns.find((c) => c.id === 'future-1');

      expect(pastCheckIn?.status).toBe('missed');
      expect(futureCheckIn?.status).toBe('pending');
    });
  });

  describe('Verification Result Calculation', () => {
    it('should pass with 80% or more completions', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);

      // 5 check-ins: 4 completed (80%), 1 missed
      const schedule: VerificationSchedule = {
        id: 'test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: pastDate,
        periodEnd: new Date(pastDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '2', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '3', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '4', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '5', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
        ],
        status: 'active',
        completedCheckIns: 4,
        createdAt: pastDate,
        updatedAt: now,
      };

      expect(calculateVerificationResult(schedule)).toBe('completed');
    });

    it('should fail with less than 80% completions', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);

      // 5 check-ins: 3 completed (60%), 2 missed
      const schedule: VerificationSchedule = {
        id: 'test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: pastDate,
        periodEnd: new Date(pastDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '2', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '3', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '4', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '5', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
        ],
        status: 'active',
        completedCheckIns: 3,
        createdAt: pastDate,
        updatedAt: now,
      };

      expect(calculateVerificationResult(schedule)).toBe('failed');
    });

    it('should remain active if period has not ended', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      expect(calculateVerificationResult(schedule)).toBe('active');
    });

    it('should detect early failure when impossible to recover', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // 5 check-ins: 0 completed, 3 missed, 2 pending
      // Need 4 (80% of 5) to pass, but only 2 pending - impossible
      const schedule: VerificationSchedule = {
        id: 'test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: pastDate,
        periodEnd: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '2', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '3', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '4', scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), windowStart: now, windowEnd: now, status: 'pending' },
          { id: '5', scheduledAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), windowStart: now, windowEnd: now, status: 'pending' },
        ],
        status: 'active',
        completedCheckIns: 0,
        createdAt: pastDate,
        updatedAt: now,
      };

      expect(calculateVerificationResult(schedule)).toBe('failed');
    });
  });

  describe('Verification Status', () => {
    it('should return not_started for null schedule', () => {
      const status = createVerificationStatus(null);
      expect(status.phase).toBe('not_started');
    });

    it('should return in_progress for active schedule', () => {
      const schedule = generateVerificationSchedule('user-123', 'tel-aviv');
      const status = createVerificationStatus(schedule);

      expect(status.phase).toBe('in_progress');
      expect(status.scheduleId).toBe(schedule.id);
      expect(status.checkInsTotal).toBe(schedule.scheduledCheckIns.length);
      expect(status.checkInsCompleted).toBe(0);
    });

    it('should return completed for completed schedule', () => {
      const now = new Date();
      const completedSchedule: VerificationSchedule = {
        id: 'completed-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: now, windowStart: now, windowEnd: now, status: 'completed' },
        ],
        status: 'completed',
        completedCheckIns: 1,
        createdAt: now,
        updatedAt: now,
      };

      const status = createVerificationStatus(completedSchedule);
      expect(status.phase).toBe('completed');
    });

    it('should return failed for failed schedule', () => {
      const now = new Date();
      const failedSchedule: VerificationSchedule = {
        id: 'failed-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: now, windowStart: now, windowEnd: now, status: 'missed' },
        ],
        status: 'failed',
        completedCheckIns: 0,
        createdAt: now,
        updatedAt: now,
      };

      const status = createVerificationStatus(failedSchedule);
      expect(status.phase).toBe('failed');
    });
  });

  describe('Schedule Progress', () => {
    it('should calculate correct progress stats', () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      const schedule: VerificationSchedule = {
        id: 'progress-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart,
        periodEnd: new Date(periodStart.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'completed' },
          { id: '2', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'completed' },
          { id: '3', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'missed' },
          { id: '4', scheduledAt: now, windowStart: now, windowEnd: now, status: 'pending' },
          { id: '5', scheduledAt: now, windowStart: now, windowEnd: now, status: 'pending' },
        ],
        status: 'active',
        completedCheckIns: 2,
        createdAt: periodStart,
        updatedAt: now,
      };

      const progress = getScheduleProgress(schedule);

      expect(progress.completedCheckIns).toBe(2);
      expect(progress.missedCheckIns).toBe(1);
      expect(progress.pendingCheckIns).toBe(2);
      expect(progress.totalCheckIns).toBe(5);
      expect(progress.completionRate).toBe(0.4); // 2/5
      expect(progress.requiredCompletionRate).toBe(0.8);
      expect(progress.canStillPass).toBe(true); // 2 completed + 2 pending = 4, need 4 (80% of 5)
    });

    it('should detect when verification cannot pass anymore', () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const schedule: VerificationSchedule = {
        id: 'no-pass-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart,
        periodEnd: new Date(periodStart.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'completed' },
          { id: '2', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'missed' },
          { id: '3', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'missed' },
          { id: '4', scheduledAt: periodStart, windowStart: periodStart, windowEnd: periodStart, status: 'missed' },
          { id: '5', scheduledAt: now, windowStart: now, windowEnd: now, status: 'pending' },
        ],
        status: 'active',
        completedCheckIns: 1,
        createdAt: periodStart,
        updatedAt: now,
      };

      const progress = getScheduleProgress(schedule);

      // 1 completed + 1 pending = 2, need 4 (80% of 5)
      expect(progress.canStillPass).toBe(false);
    });
  });

  describe('Schedule Finalization', () => {
    it('should finalize schedule with completed status', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);

      const schedule: VerificationSchedule = {
        id: 'finalize-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: pastDate,
        periodEnd: new Date(pastDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '2', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '3', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '4', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '5', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
        ],
        status: 'active',
        completedCheckIns: 5,
        createdAt: pastDate,
        updatedAt: now,
      };

      const finalized = finalizeSchedule(schedule);
      expect(finalized.status).toBe('completed');
    });

    it('should finalize schedule with failed status', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);

      const schedule: VerificationSchedule = {
        id: 'finalize-fail-test',
        userId: 'user-123',
        municipality: 'tel-aviv',
        periodStart: pastDate,
        periodEnd: new Date(pastDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        scheduledCheckIns: [
          { id: '1', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'completed' },
          { id: '2', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '3', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '4', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
          { id: '5', scheduledAt: pastDate, windowStart: pastDate, windowEnd: pastDate, status: 'missed' },
        ],
        status: 'active',
        completedCheckIns: 1,
        createdAt: pastDate,
        updatedAt: now,
      };

      const finalized = finalizeSchedule(schedule);
      expect(finalized.status).toBe('failed');
    });
  });
});
