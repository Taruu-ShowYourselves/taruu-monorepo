/**
 * Google OIDC Login Start API Route Tests (requirement #71-M1-08)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDerivedKeyCache } from '@/services/auth/keys';
import { verifyLoginOAuthState } from '@/lib/oauth-state';

describe('POST /api/auth/google/start', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_MASTER_KEY', 'a'.repeat(32));
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://taruu.co.il');
    resetDerivedKeyCache();
  });

  it('returns 500 when NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    const { POST } = await import('@/app/api/auth/google/start/route');

    const request = new Request('https://taruu.co.il/api/auth/google/start', {
      method: 'POST',
      headers: { origin: 'https://taruu.co.il' },
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('builds a Google authorize URL with a server-minted signed state and nonce, and sets the state cookie', async () => {
    const { POST } = await import('@/app/api/auth/google/start/route');

    const request = new Request('https://taruu.co.il/api/auth/google/start', {
      method: 'POST',
      headers: { origin: 'https://taruu.co.il' },
    });
    const response = await POST(request);
    const body = await response.json();

    const url = new URL(body.url);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('response_type')).toBe('code');

    const stateParam = url.searchParams.get('state');
    const nonceParam = url.searchParams.get('nonce');
    expect(stateParam).toBeTruthy();
    expect(nonceParam).toBeTruthy();

    // The raw nonce leaves the server only inside the authorize URL - it is
    // never returned as its own JSON field.
    expect(Object.keys(body)).toEqual(['url']);
    expect(body.nonce).toBeUndefined();

    // The state cookie carries the exact same value as the URL param
    // (double submit) - httpOnly, 10-minute lifetime.
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('sync-oauth-state=');
    expect(setCookie).toContain(encodeURIComponent(stateParam!));
    expect(setCookie.toLowerCase()).toContain('httponly');

    // The state token verifies as the oauth_state purpose and its payload's
    // nonce hash equals the SHA-256 of the nonce carried in the URL.
    const digestBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(nonceParam!)
    );
    const expectedHash = Array.from(new Uint8Array(digestBuffer), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');

    const decodedState = await verifyLoginOAuthState(stateParam!);
    expect(decodedState).not.toBeNull();
    expect(decodedState?.flow).toBe('login');
    expect(decodedState?.nonceHash).toBe(expectedHash);
  });
});
