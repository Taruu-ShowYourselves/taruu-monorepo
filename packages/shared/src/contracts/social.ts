/**
 * Social Proofs API Contracts
 * Zod schemas for social proof endpoints
 */

import { z } from 'zod';

// === Social Platforms ===

export const SocialPlatformSchema = z.enum(['google', 'facebook', 'instagram']);

export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

// === Identity Score ===

export const IdentityScoreBreakdownSchema = z.object({
  google: z.number().min(0).max(40),
  facebook: z.number().min(0).max(10),
  instagram: z.number().min(0).max(10),
  gps: z.number().min(0).max(20).optional(),
  phone: z.number().min(0).max(10).optional(),
  idDocument: z.number().min(0).max(40).optional(),
});

export const IdentityScoreLevelSchema = z.enum(['basic', 'verified', 'trusted']);

export const IdentityScoreSchema = z.object({
  total: z.number().min(0).max(140),
  breakdown: IdentityScoreBreakdownSchema,
  level: IdentityScoreLevelSchema,
  lastCalculated: z.string().datetime().optional(),
});

export type IdentityScoreBreakdown = z.infer<typeof IdentityScoreBreakdownSchema>;
export type IdentityScoreLevel = z.infer<typeof IdentityScoreLevelSchema>;
export type IdentityScore = z.infer<typeof IdentityScoreSchema>;

// === Social Proof ===

export const SocialProofItemSchema = z.object({
  platform: SocialPlatformSchema,
  providerId: z.string(),
  displayName: z.string().nullable().optional(),
  profileUrl: z.string().url().nullable().optional(),
  profileImage: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
  connectedAt: z.string().datetime(),
  stampWeight: z.number().min(0).max(100), // Points contribution (Google: 40, Facebook: 10, Instagram: 10)
});

export type SocialProofItem = z.infer<typeof SocialProofItemSchema>;

// === GET /api/social/proofs ===

export const GetSocialProofsResponseSchema = z.object({
  socialProofs: z.array(SocialProofItemSchema),
  identityScore: IdentityScoreSchema,
});

export type GetSocialProofsResponse = z.infer<typeof GetSocialProofsResponseSchema>;

// === DELETE /api/social/proofs ===

export const DeleteSocialProofRequestSchema = z.object({
  platform: z.enum(['facebook', 'instagram']), // Google cannot be disconnected
});

export const DeleteSocialProofResponseSchema = z.object({
  success: z.literal(true),
  socialProofs: z.array(SocialProofItemSchema),
  identityScore: IdentityScoreSchema,
});

export const SocialProofErrorSchema = z.object({
  error: z.string(),
});

export type DeleteSocialProofRequest = z.infer<typeof DeleteSocialProofRequestSchema>;
export type DeleteSocialProofResponse = z.infer<typeof DeleteSocialProofResponseSchema>;
export type SocialProofError = z.infer<typeof SocialProofErrorSchema>;
