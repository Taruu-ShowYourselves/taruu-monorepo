/**
 * In-memory rate limiting utility.
 *
 * Provides per-user and per-IP rate limiting for API endpoints.
 * In production with multiple instances, this should be replaced
 * with Redis/Upstash for distributed rate limiting.
 *
 * Usage:
 * ```ts
 * import { createRateLimiter, checkUserRateLimit } from '@/lib/rate-limit';
 *
 * // Create a rate limiter for a specific endpoint
 * const voteLimiter = createRateLimiter({
 *   windowMs: 60 * 1000,  // 1 minute
 *   maxRequests: 3,        // 3 requests per window
 * });
 *
 * // Check if user is rate limited
 * const { limited, remaining, resetIn } = voteLimiter.check(userId);
 * ```
 */

import { logger } from './logger';

const rateLimitLogger = logger.child({ component: 'rate-limit' });

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

interface RateLimitEntry {
  timestamps: number[];
  windowStart: number;
}

// Global rate limit stores - separate by endpoint to prevent interference
const rateLimitStores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(storeName: string): Map<string, RateLimitEntry> {
  let store = rateLimitStores.get(storeName);
  if (!store) {
    store = new Map<string, RateLimitEntry>();
    rateLimitStores.set(storeName, store);
  }
  return store;
}

// Periodic cleanup of expired entries (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [storeName, store] of rateLimitStores) {
      const keysToDelete: string[] = [];

      for (const [key, entry] of store) {
        // Clean entries older than 10 minutes
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
  check: (key: string) => RateLimitResult;
  /**
   * Reset rate limit for a key
   */
  reset: (key: string) => void;
}

/**
 * Create a rate limiter with the specified configuration.
 * Each limiter maintains its own store to prevent interference between endpoints.
 *
 * @param storeName - Unique name for this rate limiter's store
 * @param config - Rate limit configuration
 */
export function createRateLimiter(
  storeName: string,
  config: RateLimitConfig
): RateLimiter {
  const { windowMs, maxRequests } = config;
  const store = getStore(storeName);

  // Ensure cleanup is scheduled
  scheduleCleanup();

  return {
    check(key: string): RateLimitResult {
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

        rateLimitLogger.debug('Rate limit exceeded', {
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

    reset(key: string): void {
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
