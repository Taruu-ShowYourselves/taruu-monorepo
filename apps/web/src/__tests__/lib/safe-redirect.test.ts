/**
 * safeRedirect - post-auth redirect sanitising.
 *
 * `/sign-in?redirect=…` and `/verification?redirect=…` push their target into
 * the router. Before this helper the value went through unvalidated, so
 * `/sign-in?redirect=https://evil.example` navigated a just-signed-in resident
 * off-origin. These are the payloads that must not survive.
 */

import { describe, it, expect } from 'vitest';
import { safeRedirect } from '@/lib/safeRedirect';

const FALLBACK = '/dashboard';

describe('safeRedirect - accepts same-origin paths', () => {
  it('keeps a plain path', () => {
    expect(safeRedirect('/votes/abc-123', FALLBACK)).toBe('/votes/abc-123');
  });

  it('keeps a path with a query string and hash', () => {
    expect(safeRedirect('/votes/abc?option=1#results', FALLBACK)).toBe('/votes/abc?option=1#results');
  });

  it('keeps a locale-prefixed path', () => {
    expect(safeRedirect('/he/votes/abc', FALLBACK)).toBe('/he/votes/abc');
  });
});

describe('safeRedirect - rejects off-origin navigation', () => {
  it.each([
    ['absolute https', 'https://evil.example/steal'],
    ['absolute http', 'http://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['backslash protocol-relative', '/\\evil.example'],
    ['mixed slash-backslash', '/\\/evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['bare host', 'evil.example'],
    ['relative traversal', '../admin'],
  ])('rejects %s', (_label, payload) => {
    expect(safeRedirect(payload, FALLBACK)).toBe(FALLBACK);
  });

  it('rejects a path carrying control characters', () => {
    expect(safeRedirect('/votes\u0000/evil', FALLBACK)).toBe(FALLBACK);
    expect(safeRedirect('/votes\nSet-Cookie: x=1', FALLBACK)).toBe(FALLBACK);
  });
});

describe('safeRedirect - falls back rather than throwing', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('returns the fallback for %s', (_label, payload) => {
    expect(safeRedirect(payload, FALLBACK)).toBe(FALLBACK);
  });

  it('never throws, so a malformed redirect cannot block sign-in itself', () => {
    expect(() => safeRedirect('://///\\\\', FALLBACK)).not.toThrow();
  });
});
