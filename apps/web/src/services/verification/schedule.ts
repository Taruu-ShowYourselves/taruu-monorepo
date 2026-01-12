/**
 * Verification Schedule Service
 *
 * Generates and manages 21-day GPS verification schedules
 * with random check-in times (5-7 per verification period)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  VerificationSchedule,
  ScheduledCheckIn,
  VerificationStatus,
} from '@sync/shared';

// Constants
const VERIFICATION_PERIOD_DAYS = 21;
const MIN_CHECK_INS = 5;
const MAX_CHECK_INS = 7;
const CHECK_IN_WINDOW_MINUTES = 30;

// Working hours for check-ins (8 AM to 10 PM local time)
const CHECK_IN_HOURS_START = 8;
const CHECK_IN_HOURS_END = 22;

/**
 * Generate a random number of check-ins between MIN and MAX
 */
function getRandomCheckInCount(): number {
  return Math.floor(Math.random() * (MAX_CHECK_INS - MIN_CHECK_INS + 1)) + MIN_CHECK_INS;
}

/**
 * Generate a random time within working hours for a given day
 */
function getRandomTimeForDay(day: Date): Date {
  const hourRange = CHECK_IN_HOURS_END - CHECK_IN_HOURS_START;
  const randomHour = Math.floor(Math.random() * hourRange) + CHECK_IN_HOURS_START;
  const randomMinute = Math.floor(Math.random() * 60);

  const time = new Date(day);
  time.setHours(randomHour, randomMinute, 0, 0);
  return time;
}

/**
 * Distribute check-ins evenly across the 21-day period
 * Ensures no two check-ins are on the same day
 */
function distributeCheckInsAcrossPeriod(
  periodStart: Date,
  numberOfCheckIns: number
): Date[] {
  const daysInPeriod = VERIFICATION_PERIOD_DAYS;
  const availableDays: number[] = [];

  // Create array of day indices (0-20)
  for (let i = 0; i < daysInPeriod; i++) {
    availableDays.push(i);
  }

  // Fisher-Yates shuffle to randomize days
  for (let i = availableDays.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableDays[i], availableDays[j]] = [availableDays[j], availableDays[i]];
  }

  // Take the first N days and sort them
  const selectedDays = availableDays
    .slice(0, numberOfCheckIns)
    .sort((a, b) => a - b);

  // Generate random times for selected days
  return selectedDays.map((dayOffset) => {
    const day = new Date(periodStart);
    day.setDate(day.getDate() + dayOffset);
    return getRandomTimeForDay(day);
  });
}

/**
 * Create a scheduled check-in object
 */
function createScheduledCheckIn(scheduledAt: Date): ScheduledCheckIn {
  const windowEnd = new Date(scheduledAt);
  windowEnd.setMinutes(windowEnd.getMinutes() + CHECK_IN_WINDOW_MINUTES);

  return {
    id: uuidv4(),
    scheduledAt,
    windowStart: scheduledAt,
    windowEnd,
    status: 'pending',
  };
}

/**
 * Generate a new verification schedule for a user
 */
export function generateVerificationSchedule(
  userId: string,
  municipality: string
): VerificationSchedule {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setHours(0, 0, 0, 0); // Start of today

  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + VERIFICATION_PERIOD_DAYS);

  const numberOfCheckIns = getRandomCheckInCount();
  const checkInTimes = distributeCheckInsAcrossPeriod(periodStart, numberOfCheckIns);
  const scheduledCheckIns = checkInTimes.map(createScheduledCheckIn);

  return {
    id: uuidv4(),
    userId,
    municipality,
    periodStart,
    periodEnd,
    scheduledCheckIns,
    status: 'active',
    completedCheckIns: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get the next pending check-in for a schedule
 */
export function getNextCheckIn(
  schedule: VerificationSchedule
): ScheduledCheckIn | null {
  const now = new Date();

  // Find the first pending check-in that hasn't passed yet
  return (
    schedule.scheduledCheckIns.find(
      (checkIn) =>
        checkIn.status === 'pending' && new Date(checkIn.windowEnd) > now
    ) || null
  );
}

/**
 * Check if a check-in is currently active (within window)
 */
export function isCheckInActive(checkIn: ScheduledCheckIn): boolean {
  const now = new Date();
  const windowStart = new Date(checkIn.windowStart);
  const windowEnd = new Date(checkIn.windowEnd);
  return now >= windowStart && now <= windowEnd;
}

/**
 * Mark a check-in as completed
 */
export function completeCheckIn(
  schedule: VerificationSchedule,
  checkInId: string,
  location: { latitude: number; longitude: number; accuracy?: number },
  municipalityVerified: boolean
): VerificationSchedule {
  const now = new Date();
  const updatedCheckIns = schedule.scheduledCheckIns.map((checkIn) => {
    if (checkIn.id === checkInId) {
      return {
        ...checkIn,
        status: 'completed' as const,
        completedAt: now,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: now,
        },
        municipalityVerified,
      };
    }
    return checkIn;
  });

  const completedCount = updatedCheckIns.filter(
    (c) => c.status === 'completed'
  ).length;

  return {
    ...schedule,
    scheduledCheckIns: updatedCheckIns,
    completedCheckIns: completedCount,
    updatedAt: now,
  };
}

/**
 * Mark a check-in as missed
 */
export function missCheckIn(
  schedule: VerificationSchedule,
  checkInId: string
): VerificationSchedule {
  const now = new Date();
  const updatedCheckIns = schedule.scheduledCheckIns.map((checkIn) => {
    if (checkIn.id === checkInId) {
      return {
        ...checkIn,
        status: 'missed' as const,
      };
    }
    return checkIn;
  });

  return {
    ...schedule,
    scheduledCheckIns: updatedCheckIns,
    updatedAt: now,
  };
}

/**
 * Process expired check-ins (mark as missed if window has passed)
 */
export function processExpiredCheckIns(
  schedule: VerificationSchedule
): VerificationSchedule {
  const now = new Date();
  let updated = false;
  const updatedCheckIns = schedule.scheduledCheckIns.map((checkIn) => {
    if (
      checkIn.status === 'pending' &&
      new Date(checkIn.windowEnd) < now
    ) {
      updated = true;
      return {
        ...checkIn,
        status: 'missed' as const,
      };
    }
    return checkIn;
  });

  if (!updated) {
    return schedule;
  }

  return {
    ...schedule,
    scheduledCheckIns: updatedCheckIns,
    updatedAt: now,
  };
}

/**
 * Calculate the verification result (complete or fail)
 * Must complete at least 80% of check-ins to pass
 */
export function calculateVerificationResult(
  schedule: VerificationSchedule
): 'completed' | 'failed' | 'active' {
  const now = new Date();
  const periodEnd = new Date(schedule.periodEnd);

  // Still in progress
  if (now < periodEnd) {
    // Check if already failed (too many missed to recover)
    const completed = schedule.scheduledCheckIns.filter(
      (c) => c.status === 'completed'
    ).length;
    const missed = schedule.scheduledCheckIns.filter(
      (c) => c.status === 'missed'
    ).length;
    const pending = schedule.scheduledCheckIns.filter(
      (c) => c.status === 'pending'
    ).length;

    const total = schedule.scheduledCheckIns.length;
    const requiredCompletions = Math.ceil(total * 0.8);

    // Check if it's impossible to complete
    if (completed + pending < requiredCompletions) {
      return 'failed';
    }

    return 'active';
  }

  // Period ended - calculate final result
  const completed = schedule.scheduledCheckIns.filter(
    (c) => c.status === 'completed'
  ).length;
  const total = schedule.scheduledCheckIns.length;
  const completionRate = completed / total;

  return completionRate >= 0.8 ? 'completed' : 'failed';
}

/**
 * Finalize a verification schedule
 */
export function finalizeSchedule(
  schedule: VerificationSchedule
): VerificationSchedule {
  const result = calculateVerificationResult(schedule);

  return {
    ...schedule,
    status: result,
    updatedAt: new Date(),
  };
}

/**
 * Create verification status from schedule
 */
export function createVerificationStatus(
  schedule: VerificationSchedule | null
): VerificationStatus {
  if (!schedule) {
    return {
      phase: 'not_started',
    };
  }

  const nextCheckIn = getNextCheckIn(schedule);
  const completed = schedule.scheduledCheckIns.filter(
    (c) => c.status === 'completed'
  ).length;

  if (schedule.status === 'completed') {
    return {
      phase: 'completed',
      startedAt: schedule.periodStart,
      completedAt: schedule.updatedAt,
      scheduleId: schedule.id,
      checkInsCompleted: completed,
      checkInsTotal: schedule.scheduledCheckIns.length,
    };
  }

  if (schedule.status === 'failed') {
    return {
      phase: 'failed',
      startedAt: schedule.periodStart,
      scheduleId: schedule.id,
      checkInsCompleted: completed,
      checkInsTotal: schedule.scheduledCheckIns.length,
    };
  }

  return {
    phase: 'in_progress',
    startedAt: schedule.periodStart,
    scheduleId: schedule.id,
    checkInsCompleted: completed,
    checkInsTotal: schedule.scheduledCheckIns.length,
    nextCheckIn: nextCheckIn?.scheduledAt,
  };
}

/**
 * Get schedule progress info for UI
 */
export function getScheduleProgress(schedule: VerificationSchedule): {
  daysRemaining: number;
  daysElapsed: number;
  completedCheckIns: number;
  totalCheckIns: number;
  missedCheckIns: number;
  pendingCheckIns: number;
  completionRate: number;
  requiredCompletionRate: number;
  canStillPass: boolean;
} {
  const now = new Date();
  const periodStart = new Date(schedule.periodStart);
  const periodEnd = new Date(schedule.periodEnd);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((now.getTime() - periodStart.getTime()) / msPerDay);
  const daysRemaining = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - now.getTime()) / msPerDay)
  );

  const completed = schedule.scheduledCheckIns.filter(
    (c) => c.status === 'completed'
  ).length;
  const missed = schedule.scheduledCheckIns.filter(
    (c) => c.status === 'missed'
  ).length;
  const pending = schedule.scheduledCheckIns.filter(
    (c) => c.status === 'pending'
  ).length;

  const total = schedule.scheduledCheckIns.length;
  const requiredCompletions = Math.ceil(total * 0.8);
  const canStillPass = completed + pending >= requiredCompletions;

  return {
    daysRemaining,
    daysElapsed,
    completedCheckIns: completed,
    totalCheckIns: total,
    missedCheckIns: missed,
    pendingCheckIns: pending,
    completionRate: total > 0 ? completed / total : 0,
    requiredCompletionRate: 0.8,
    canStillPass,
  };
}
