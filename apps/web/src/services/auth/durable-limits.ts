/**
 * Durable rate-limit helpers (canonical §9). The authoritative MFA limits
 * are DB-backed - row counters and windowed counts over security_events -
 * never the in-memory limiter (per-process, resets on deploy). All limits
 * are time-windowed and self-expiring; there are no durable lockout flags
 * (a locked column is an attacker-triggerable DoS).
 *
 * Counters that fail to read make the guarded action refuse (fail closed) -
 * the callers get that behavior by treating a null count as "over".
 */

import { NextResponse } from 'next/server';

export const HOUR_MS = 60 * 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export function windowStartIso(windowMs: number, now: number = Date.now()): string {
  return new Date(now - windowMs).toISOString();
}

/**
 * True when the count says stop - including when the count itself failed
 * (null): an unreadable durable counter must refuse, not wave through.
 */
export function overLimit(count: number | null, max: number): boolean {
  return count === null || count >= max;
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.', code: 'RATE_LIMITED' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}
