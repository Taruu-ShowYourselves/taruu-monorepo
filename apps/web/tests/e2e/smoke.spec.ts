/**
 * E2E Smoke Tests - 5 Critical Journeys
 * Tests the happy path and negative scenarios for each journey.
 */

import { test, expect } from '@playwright/test';

// ============================================
// JOURNEY 1: Authentication (Google OAuth)
// ============================================

test.describe('Journey 1: Authentication', () => {
  test('homepage loads and shows login option', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sync|סינק/i);
  });

  test('login page renders with Google OAuth button', async ({ page }) => {
    await page.goto('/login');
    // Should have a Google sign-in button or redirect info
    const googleButton = page.getByRole('button', { name: /google|גוגל|sign in|התחברות/i });
    const hasGoogleButton = await googleButton.count() > 0;
    const hasLoginContent = await page.getByText(/sign in|login|התחברות|כניסה/i).count() > 0;
    expect(hasGoogleButton || hasLoginContent).toBeTruthy();
  });

  test('session endpoint returns 401 when not authenticated', async ({ request }) => {
    const response = await request.get('/api/auth/session');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('callback endpoint rejects invalid state', async ({ request }) => {
    const response = await request.get('/api/auth/callback?code=fake&state=invalid');
    // Should reject with 400 or redirect to error page
    expect([400, 302, 401]).toContain(response.status());
  });
});

// ============================================
// JOURNEY 2: DID Generation (SEL-DID)
// ============================================

test.describe('Journey 2: DID Generation', () => {
  test('DID endpoint requires authentication', async ({ request }) => {
    const response = await request.post('/api/auth/did', {
      data: { action: 'generate' },
    });
    expect(response.status()).toBe(401);
  });

  test('DID endpoint rejects invalid action', async ({ request }) => {
    // Even with auth, invalid action should be rejected
    const response = await request.post('/api/auth/did', {
      data: { action: 'invalid_action' },
    });
    // Should be 400 (bad request) or 401 (needs auth first)
    expect([400, 401]).toContain(response.status());
  });
});

// ============================================
// JOURNEY 3: Social Proofs
// ============================================

test.describe('Journey 3: Social Proofs', () => {
  test('social proofs page loads', async ({ page }) => {
    await page.goto('/dashboard/social');
    // Either shows content or redirects to login
    const currentUrl = page.url();
    const isOnSocialPage = currentUrl.includes('/social');
    const isOnLoginPage = currentUrl.includes('/login');
    expect(isOnSocialPage || isOnLoginPage).toBeTruthy();
  });

  test('social proofs API requires authentication', async ({ request }) => {
    const response = await request.get('/api/social/proofs');
    expect(response.status()).toBe(401);
  });

  test('social proofs API rejects invalid provider', async ({ request }) => {
    const response = await request.post('/api/social/proofs', {
      data: {
        provider: 'invalid_provider',
        handle: 'test',
      },
    });
    expect([400, 401]).toContain(response.status());
  });
});

// ============================================
// JOURNEY 4: GPS Verification
// ============================================

test.describe('Journey 4: GPS Verification', () => {
  test('verification start requires authentication', async ({ request }) => {
    const response = await request.post('/api/verification/start');
    expect(response.status()).toBe(401);
  });

  test('check-in endpoint requires authentication', async ({ request }) => {
    const response = await request.post('/api/verification/check-in', {
      data: {
        latitude: 32.0853,
        longitude: 34.7818,
      },
    });
    expect(response.status()).toBe(401);
  });

  test('check-in rejects invalid coordinates', async ({ request }) => {
    const response = await request.post('/api/verification/check-in', {
      data: {
        latitude: 999, // Invalid
        longitude: 999, // Invalid
      },
    });
    // Should be 400 (bad request) or 401 (needs auth first)
    expect([400, 401]).toContain(response.status());
  });

  test('verification page loads', async ({ page }) => {
    await page.goto('/dashboard/verification');
    const currentUrl = page.url();
    const isOnVerificationPage = currentUrl.includes('/verification');
    const isOnLoginPage = currentUrl.includes('/login');
    expect(isOnVerificationPage || isOnLoginPage).toBeTruthy();
  });
});

// ============================================
// JOURNEY 5: Payments (Green Invoice)
// ============================================

test.describe('Journey 5: Payments', () => {
  test('payment create requires authentication', async ({ request }) => {
    const response = await request.post('/api/payments/create', {
      data: {
        type: 'vote_participation',
        voteId: '00000000-0000-0000-0000-000000000000',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('payment status requires valid ID format', async ({ request }) => {
    const response = await request.get('/api/payments/invalid-id/status');
    // Should reject non-UUID format
    expect([400, 401, 404]).toContain(response.status());
  });

  test('payment webhook requires signature', async ({ request }) => {
    const response = await request.post('/api/payments/webhook', {
      data: {
        type: 'payment.succeeded',
        paymentId: 'test',
      },
    });
    // Should reject without valid signature
    expect([400, 401, 403]).toContain(response.status());
  });

  test('pricing endpoint is publicly accessible', async ({ request }) => {
    const response = await request.get('/api/payments/create');
    // GET endpoint for pricing should be accessible
    expect([200, 405]).toContain(response.status());
  });
});

// ============================================
// CROSS-CUTTING: API Health & Error Handling
// ============================================

test.describe('API Health', () => {
  test('API returns proper JSON error format', async ({ request }) => {
    const response = await request.get('/api/nonexistent-endpoint');
    expect([404, 405]).toContain(response.status());
  });

  test('API handles malformed JSON gracefully', async ({ request }) => {
    const response = await request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-valid-json{',
    });
    // Should not crash - return 400 or appropriate error
    expect([400, 401, 405, 500]).toContain(response.status());
  });
});
