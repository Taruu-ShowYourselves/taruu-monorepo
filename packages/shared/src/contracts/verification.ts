/**
 * Verification API Contracts
 * Zod schemas for GPS verification endpoints
 */

import { z } from 'zod';

// === Verification Status ===

export const VerificationPhaseSchema = z.enum(['not_started', 'in_progress', 'completed', 'failed']);
export const VerificationRunStatusSchema = z.enum(['active', 'verified', 'failed', 'cancelled']);

export type VerificationPhase = z.infer<typeof VerificationPhaseSchema>;
export type VerificationRunStatus = z.infer<typeof VerificationRunStatusSchema>;

// === GPS Coordinates ===

export const GpsCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export type GpsCoordinates = z.infer<typeof GpsCoordinatesSchema>;

// === POST /api/verification/start ===

export const StartVerificationResponseSchema = z.object({
  success: z.literal(true),
  schedule: z.object({
    id: z.string().uuid(),
    municipality: z.string(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    totalCheckIns: z.number().min(5).max(7),
    nextCheckIn: z.string().datetime().optional(),
  }),
  verificationStatus: z.object({
    phase: VerificationPhaseSchema,
    completedCheckIns: z.number(),
    totalCheckIns: z.number(),
  }),
});

export const StartVerificationErrorSchema = z.object({
  error: z.string(),
});

export type StartVerificationResponse = z.infer<typeof StartVerificationResponseSchema>;
export type StartVerificationError = z.infer<typeof StartVerificationErrorSchema>;

// === GET /api/verification/schedule ===

export const GetScheduleResponseSchema = z.object({
  schedule: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    municipality: z.string(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    status: VerificationRunStatusSchema,
    completedCheckIns: z.number(),
    totalCheckIns: z.number(),
    pendingCheckIns: z.number(),
    failedCheckIns: z.number(),
    nextCheckIn: z.object({
      windowStart: z.string().datetime(),
      windowEnd: z.string().datetime(),
    }).nullable(),
  }),
  metadata: z.object({
    generatedAt: z.string().datetime(),
  }),
});

export type GetScheduleResponse = z.infer<typeof GetScheduleResponseSchema>;

// === POST /api/verification/check-in ===

export const CheckInRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  scheduleId: z.string().uuid().optional(),
});

export const CheckInSuccessResponseSchema = z.object({
  success: z.literal(true),
  verified: z.literal(true),
  checkIn: z.object({
    id: z.string().uuid(),
    completedAt: z.string().datetime(),
    location: GpsCoordinatesSchema,
    municipalityVerified: z.literal(true),
    distanceFromCenter: z.number().optional(),
  }),
  verificationStatus: z.object({
    phase: VerificationPhaseSchema,
    completedCheckIns: z.number(),
    totalCheckIns: z.number(),
  }),
  progress: z.object({
    completedCheckIns: z.number(),
    totalCheckIns: z.number(),
    completionRate: z.number().min(0).max(1),
  }),
});

export const CheckInFailureResponseSchema = z.object({
  success: z.literal(false),
  verified: z.literal(false),
  error: z.string(),
  details: z.object({
    inMunicipality: z.boolean().optional(),
    accuracyAcceptable: z.boolean().optional(),
    distanceFromCenter: z.number().optional(),
  }).optional(),
});

export const CheckInResponseSchema = z.discriminatedUnion('success', [
  CheckInSuccessResponseSchema,
  CheckInFailureResponseSchema,
]);

export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;
export type CheckInSuccessResponse = z.infer<typeof CheckInSuccessResponseSchema>;
export type CheckInFailureResponse = z.infer<typeof CheckInFailureResponseSchema>;
export type CheckInResponse = z.infer<typeof CheckInResponseSchema>;

// === GET /api/verification/status ===

export const GetVerificationStatusResponseSchema = z.object({
  status: z.enum(['none', 'pending', 'verified', 'failed']),
  run: z.object({
    id: z.string().uuid(),
    municipality: z.string(),
    completedCheckIns: z.number(),
    totalCheckIns: z.number(),
    startedAt: z.string().datetime(),
  }).optional(),
});

export type GetVerificationStatusResponse = z.infer<typeof GetVerificationStatusResponseSchema>;
