/**
 * Rate limiting utility with Upstash Redis support.
 *
 * Uses Upstash Redis for production (persistent across restarts).
 * Falls back to in-memory storage for local development.
 *
 * Usage:
 * ```ts
 * import { voteParticipationLimiter, createRateLimitResponse } from '@/lib/rate-limit';
 *
 * // Check if user is rate limited
 * const result = await voteParticipationLimiter.check(userId);
 * if (result.limited) {
 *   return createRateLimitResponse(result);
 * }
 * ```
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

const rateLimitLogger = logger.child({ component: 'rate-limit' });

// Check if Upstash Redis is configured
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

if (!USE_REDIS) {
  rateLimitLogger.warn(
    'Upstash Redis not configured - using in-memory rate limiting (not suitable for production)'
  );
}

// Initialize Redis client if configured
const redis = USE_REDIS
  ? new Redis({
      url: UPSTASH_URL!,
      token: UPSTASH_TOKEN!,
    })
  : null;

export interface RateLimitConfig {
  /**
   * Time window in milliseconds
   * Default: 60000 (1 minute)
   */
  windowMs: number;
  /**
   * Maximum number of requests per window
   */
  maxRequests: number;
}

export interface RateLimitResult {
  /**
   * Whether the request is rate limited
   */
  limited: boolean;
  /**
   * Number of remaining requests in current window
   */
  remaining: number;
  /**
   * Milliseconds until the rate limit resets
   */
  resetIn: number;
}

// In-memory fallback implementation
interface RateLimitEntry {
  timestamps: number[];
  windowStart: number;
}

const rateLimitStores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(storeName: string): Map<string, RateLimitEntry> {
  let store = rateLimitStores.get(storeName);
  if (!store) {
    store = new Map<string, RateLimitEntry>();
    rateLimitStores.set(storeName, store);
  }
  return store;
}

// Periodic cleanup of expired entries (every 5 minutes) - only for in-memory
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled || USE_REDIS) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [, store] of rateLimitStores) {
      const keysToDelete: string[] = [];

      for (const [key, entry] of store) {
        if (now - entry.windowStart > 10 * 60 * 1000) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        store.delete(key);
        totalCleaned++;
      }
    }

    if (totalCleaned > 0) {
      rateLimitLogger.debug('Cleaned expired rate limit entries', { count: totalCleaned });
    }
  }, CLEANUP_INTERVAL);
}

export interface RateLimiter {
  /**
   * Check if a key (userId or IP) is rate limited
   */
  check: (key: string) => Promise<RateLimitResult>;
  /**
   * Reset rate limit for a key
   */
  reset: (key: string) => Promise<void>;
}

/**
 * Create a rate limiter with the specified configuration.
 * Uses Upstash Redis if configured, otherwise falls back to in-memory.
 *
 * @param storeName - Unique name for this rate limiter's store
 * @param config - Rate limit configuration
 */
export function createRateLimiter(
  storeName: string,
  config: RateLimitConfig
): RateLimiter {
  const { windowMs, maxRequests } = config;

  // Use Upstash if configured
  if (redis) {
    const windowSeconds = Math.ceil(windowMs / 1000);
    const upstashLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: `@sync/ratelimit:${storeName}`,
      analytics: true,
    });

    return {
      async check(key: string): Promise<RateLimitResult> {
        const { success, remaining, reset } = await upstashLimiter.limit(key);
        const now = Date.now();
        const resetIn = Math.max(0, reset - now);

        if (!success) {
          rateLimitLogger.debug('Rate limit exceeded (Redis)', {
            key,
            storeName,
            remaining,
            resetIn,
          });
        }

        return {
          limited: !success,
          remaining,
          resetIn,
        };
      },

      async reset(key: string): Promise<void> {
        await upstashLimiter.resetUsedTokens(key);
      },
    };
  }

  // In-memory fallback
  const store = getStore(storeName);
  scheduleCleanup();

  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const entry = store.get(key);

      // If no entry or window has expired, start fresh
      if (!entry || now - entry.windowStart >= windowMs) {
        store.set(key, {
          timestamps: [now],
          windowStart: now,
        });
        return {
          limited: false,
          remaining: maxRequests - 1,
          resetIn: windowMs,
        };
      }

      // Filter timestamps within current window
      const recentTimestamps = entry.timestamps.filter(
        (timestamp) => now - timestamp < windowMs
      );

      // Check if rate limited
      if (recentTimestamps.length >= maxRequests) {
        const oldestTimestamp = Math.min(...recentTimestamps);
        const resetIn = windowMs - (now - oldestTimestamp);

        rateLimitLogger.debug('Rate limit exceeded (in-memory)', {
          key,
          storeName,
          requests: recentTimestamps.length,
          maxRequests,
          resetIn,
        });

        return {
          limited: true,
          remaining: 0,
          resetIn: Math.max(0, resetIn),
        };
      }

      // Add current timestamp
      recentTimestamps.push(now);
      store.set(key, {
        timestamps: recentTimestamps,
        windowStart: entry.windowStart,
      });

      return {
        limited: false,
        remaining: maxRequests - recentTimestamps.length,
        resetIn: windowMs - (now - entry.windowStart),
      };
    },

    async reset(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

// Pre-configured rate limiters for common endpoints

/**
 * Rate limiter for vote participation endpoint.
 * 3 requests per minute per user.
 * Prevents abuse of the payment/blockchain system.
 */
export const voteParticipationLimiter = createRateLimiter('vote-participation', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3,
});

/**
 * Rate limiter for verification check-in endpoint.
 * 10 requests per minute per user.
 * Allows multiple attempts during verification window.
 */
export const verificationCheckInLimiter = createRateLimiter('verification-check-in', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

/**
 * Rate limiter for identity-document submission endpoint.
 * 5 requests per minute per user.
 * Scanning retries happen client-side; server submissions should be rare.
 */
export const identityDocumentLimiter = createRateLimiter('identity-document', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
});

/**
 * Rate limiter for newsletter subscription endpoint.
 * 3 requests per minute per IP.
 * Prevents spam signups.
 */
export const newsletterLimiter = createRateLimiter('newsletter', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3,
});

/**
 * Helper function to create a 429 response with rate limit headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000)),
    'Retry-After': String(Math.ceil(result.resetIn / 1000)),
  });

  return new Response(
    JSON.stringify({
      error: message || 'יותר מדי בקשות. נסו שוב מאוחר יותר.',
      remaining: result.remaining,
      resetIn: result.resetIn,
    }),
    {
      status: 429,
      headers,
    }
  );
}
