/**
 * Aggregate-only public contract for GET /api/councils/[identifier].
 *
 * Deliberately keep this allow-list separate from database row types. Adding a
 * private database column can therefore never add it to the public response.
 */

import { z } from 'zod';

export const CouncilMetricStatusSchema = z.enum([
  'available',
  'stale',
  'unavailable',
]);

export const CouncilMetricSourceSchema = z.object({
  name: z.string(),
  url: z.string().url().nullable(),
  asOf: z.string(),
  updatedAt: z.string(),
});

export const CouncilMetricSchema = z.object({
  value: z.number().int().nonnegative().nullable(),
  status: CouncilMetricStatusSchema,
  definition: z.string(),
  source: CouncilMetricSourceSchema.nullable(),
});

export const PublicCouncilProfileSchema = z.object({
  council: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    slug: z.string(),
    canonicalUrl: z.string(),
  }),
  generatedAt: z.string().datetime(),
  metrics: z.object({
    officialPopulation: CouncilMetricSchema,
    registeredUsers: CouncilMetricSchema,
    communityManagers: CouncilMetricSchema,
    payingUsers: CouncilMetricSchema,
    relevantVotes: CouncilMetricSchema,
    activeVotes: CouncilMetricSchema,
  }),
  links: z.object({
    votes: z.string(),
    civicSpace: z.string(),
  }),
});

export type CouncilMetricStatus = z.infer<typeof CouncilMetricStatusSchema>;
export type CouncilMetricSource = z.infer<typeof CouncilMetricSourceSchema>;
export type CouncilMetric = z.infer<typeof CouncilMetricSchema>;
export type PublicCouncilProfile = z.infer<typeof PublicCouncilProfileSchema>;
