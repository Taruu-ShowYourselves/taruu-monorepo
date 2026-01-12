/**
 * Retry Utility
 *
 * Provides retry logic for failed operations with exponential backoff.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate delay for next retry with exponential backoff
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable'>>
): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  if (options.jitter) {
    // Add random jitter (±25%)
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry logic
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchData(),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}:`, error)
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (options.isRetryable && !options.isRetryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      const delay = calculateDelay(attempt, opts);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for a function
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(fetchData, { maxAttempts: 3 });
 * const result = await fetchWithRetry();
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => retry(() => fn(...args), options)) as T;
}

/**
 * Common retry predicates
 */
export const RetryPredicates = {
  /** Retry on network errors */
  isNetworkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      );
    }
    return false;
  },

  /** Retry on HTTP 5xx errors */
  isServerError: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status >= 500 && status < 600;
    }
    return false;
  },

  /** Retry on rate limit errors (HTTP 429) */
  isRateLimitError: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 429;
    }
    return false;
  },

  /** Retry on common transient errors */
  isTransientError: (error: unknown): boolean => {
    return (
      RetryPredicates.isNetworkError(error) ||
      RetryPredicates.isServerError(error) ||
      RetryPredicates.isRateLimitError(error)
    );
  },
};

/**
 * Hebrew error messages for retry failures
 */
export const RetryErrorMessages = {
  MAX_ATTEMPTS_EXCEEDED: 'הפעולה נכשלה לאחר מספר ניסיונות. אנא נסו שוב מאוחר יותר.',
  NETWORK_ERROR: 'שגיאת רשת. בדקו את החיבור לאינטרנט ונסו שוב.',
  SERVER_ERROR: 'שגיאת שרת. אנא נסו שוב בעוד מספר דקות.',
  RATE_LIMITED: 'יותר מדי בקשות. אנא המתינו מספר שניות ונסו שוב.',
};
