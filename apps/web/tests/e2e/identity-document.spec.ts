/**
 * E2E — Identity-document verification (issue #32).
 *
 * Runs against `next dev` + the real (dev) Supabase project:
 *  - unauthenticated guards and self-hosted OCR/face assets
 *  - authenticated API round-trip: submit → status → dedup conflict → erase
 *  - authenticated UI walk: phone (mock-degraded) → consent → details →
 *    upload a real specimen image → on-device OCR → review fields
 *
 * Session cookies are minted directly with JWT_SECRET from .dev.vars; test
 * users are created and removed via the Supabase service role.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// Fake camera for the whole file — launchOptions must be top-level.
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});
import { SignJWT } from 'jose';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---- env / helpers ---------------------------------------------------------

function parseEnvFile(file: string): Record<string, string> {
  try {
    const raw = readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
    return Object.fromEntries(
      raw
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [
          l.slice(0, l.indexOf('=')).trim(),
          l.slice(l.indexOf('=') + 1).trim(),
        ])
    );
  } catch {
    return {};
  }
}

// `next dev` gives .env.local precedence over the .dev.vars shim — mirror that.
const vars = { ...parseEnvFile('.dev.vars'), ...parseEnvFile('.env.local') };
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

function admin(): SupabaseClient {
  return createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);
}

interface TestUser {
  id: string;
  email: string;
  cookie: string;
  refreshCookie: string;
}

async function createTestUser(tag: string): Promise<TestUser> {
  const email = `e2e-identity-${tag}-${Date.now()}@test.taruu.local`;
  const db = admin();
  const { data, error } = await db
    .from('users')
    .insert({ email, first_name: 'בדיקה', last_name: 'אוטומטית' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`test user insert failed: ${error?.message}`);

  const token = await new SignJWT({
    userId: data.id,
    googleId: `e2e-${tag}-${Date.now()}`,
    did: `did:sync:e2e${tag}`,
    email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(data.id)
    .sign(new TextEncoder().encode(vars.JWT_SECRET));

  // The client's refreshSession() needs the refresh cookie too.
  const refresh = await new SignJWT({ userId: data.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .setSubject(data.id)
    .sign(new TextEncoder().encode(vars.JWT_SECRET));

  return { id: data.id, email, cookie: token, refreshCookie: refresh };
}

async function deleteTestUser(id: string): Promise<void> {
  const db = admin();
  await db.from('identity_document_events').delete().eq('user_id', id);
  await db.from('identity_documents').delete().eq('user_id', id);
  await db.from('users').delete().eq('id', id);
}

// 123456782 satisfies the Israeli ID checksum (public canonical test value).
const VALID_SUBMISSION = {
  documentType: 'id_card',
  idNumber: '123456782',
  firstName: 'דוד',
  lastName: 'כהן',
  dateOfBirth: '1974-04-04',
  documentExpiry: '2031-03-15',
  ocr: { idNumberMatched: true, confidence: 85, fieldsEdited: false },
  face: {
    checked: true,
    docFaceFound: true,
    matchScore: 72,
    livenessPassed: true,
    antispoofScore: 80,
  },
  consentVersion: 'doc-face-consent-v2-2026-07',
};

// ---- guards + assets -------------------------------------------------------

test.describe('guards and self-hosted assets', () => {
  test('verification page bounces unauthenticated visitors to sign-in', async ({
    page,
  }) => {
    await page.goto('/he/verification');
    await page.waitForURL(/sign-in/, { timeout: 15000 });
  });

  test('document API requires a session on every method', async ({ request }) => {
    for (const method of ['post', 'get', 'delete'] as const) {
      const res = await request[method]('/api/verification/document', {
        data: method === 'post' ? VALID_SUBMISSION : undefined,
      });
      expect(res.status(), method).toBe(401);
    }
  });

  test('OCR and face models are served from our origin', async ({ request }) => {
    const assets = [
      '/ocr/worker.min.js',
      '/ocr/tesseract-core-simd-lstm.wasm.js',
      '/ocr/tesseract-core-relaxedsimd-lstm.wasm.js',
      '/ocr/heb.traineddata.gz',
      '/ocr/eng.traineddata.gz',
      '/models/human/blazeface.json',
      '/models/human/facemesh.bin',
      '/models/human/faceres.bin',
      '/models/human/antispoof.bin',
    ];
    for (const asset of assets) {
      const res = await request.get(asset);
      expect(res.status(), asset).toBe(200);
      expect((await res.body()).length, asset).toBeGreaterThan(1000);
    }
  });
});

// ---- authenticated API round-trip -----------------------------------------

test.describe('authenticated API round-trip', () => {
  let user: TestUser;
  let rival: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser('api');
    rival = await createTestUser('rival');
  });

  test.afterAll(async () => {
    await deleteTestUser(user.id);
    await deleteTestUser(rival.id);
  });

  test('submit → status → dedup conflict → erase', async ({ playwright }) => {
    const asUser = await playwright.request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { Cookie: `sync-session=${user.cookie}` },
    });
    const asRival = await playwright.request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { Cookie: `sync-session=${rival.cookie}` },
    });

    // Submit a clean document — auto-verifies.
    const submit = await asUser.post('/api/verification/document', {
      data: VALID_SUBMISSION,
    });
    expect(submit.status()).toBe(200);
    const submitted = await submit.json();
    expect(submitted.status).toBe('verified');
    expect(submitted.idNumberMasked).toBe('•••••••82');
    expect(submitted.verifiedAt).toBeTruthy();

    // Status reflects it.
    const status = await asUser.get('/api/verification/document');
    expect((await status.json()).document?.status).toBe('verified');

    // Same ID number on another account → 409.
    const conflict = await asRival.post('/api/verification/document', {
      data: VALID_SUBMISSION,
    });
    expect(conflict.status()).toBe(409);

    // Weak face evidence → pending_review, not verified.
    const weakFace = await asRival.post('/api/verification/document', {
      data: {
        ...VALID_SUBMISSION,
        idNumber: '123456790', // also checksum-valid
        face: { ...VALID_SUBMISSION.face, matchScore: 20, livenessPassed: false },
      },
    });
    expect(weakFace.status()).toBe(200);
    expect((await weakFace.json()).status).toBe('pending_review');

    // Hard failures reject.
    const expired = await asUser.post('/api/verification/document', {
      data: { ...VALID_SUBMISSION, documentExpiry: '2020-01-01' },
    });
    expect(expired.status()).toBe(400);

    // §14 erasure.
    const erase = await asUser.delete('/api/verification/document');
    expect(erase.status()).toBe(200);
    const after = await asUser.get('/api/verification/document');
    expect((await after.json()).document).toBeNull();

    await asUser.dispose();
    await asRival.dispose();
  });
});

// ---- authenticated UI walk (upload path, real on-device OCR) ---------------

test.describe('authenticated UI walk', () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser('ui');
  });

  test.afterAll(async () => {
    await deleteTestUser(user.id);
  });

  test('phone → consent → details → upload specimen → OCR review fields', async ({
    page,
  }) => {
    test.setTimeout(180_000); // first OCR pass downloads+boots WASM in-browser

    await page.context().addCookies([
      { name: 'sync-session', value: user.cookie, url: BASE },
      { name: 'sync-refresh', value: user.refreshCookie, url: BASE },
    ]);

    // Keep the municipality GeoGate dialog from covering the flow, and seed
    // the zustand auth store — the SPA authenticates with a Bearer token from
    // localStorage ('sync-auth-storage'), not with the cookies alone.
    await page.addInitScript(
      ([token, refresh, userId, email]) => {
        window.sessionStorage.setItem('taruu.muni.dismissed', '1');
        window.localStorage.setItem(
          'sync-auth-storage',
          JSON.stringify({
            state: {
              user: { id: userId, email, firstName: 'בדיקה', lastName: 'אוטומטית' },
              accessToken: token,
              refreshToken: refresh,
              expiresAt: new Date(Date.now() + 3600_000).toISOString(),
              isAuthenticated: true,
            },
            version: 0,
          })
        );
      },
      [user.cookie, user.refreshCookie, user.id, user.email]
    );

    await page.goto('/he/verification');

    // Step 1 — phone (SMS service absent in dev → mock-degrades forward).
    await page.getByPlaceholder('05X-XXXXXXX').fill('0501234567');
    await page.getByRole('button', { name: 'שלחו קוד' }).click();
    await page.getByPlaceholder('------').fill('123456');
    await page.getByRole('button', { name: 'אמתו קוד' }).click();

    // Step 2 — document consent: both boxes required.
    await expect(
      page.getByRole('heading', { name: /סריקת תעודה/ })
    ).toBeVisible({ timeout: 20000 });
    const consentBoxes = page.locator('input[type=checkbox]');
    await expect(consentBoxes).toHaveCount(2);
    const continueBtn = page.getByRole('button', { name: 'ממשיכים לאימות' });
    await expect(continueBtn).toBeDisabled();
    await consentBoxes.nth(0).check();
    await expect(continueBtn).toBeDisabled();
    await consentBoxes.nth(1).check();
    await continueBtn.click();

    // Details — a checksum-invalid ID is refused inline.
    const idInput = page.getByPlaceholder('—————————');
    await idInput.fill('123456789');
    await page.getByRole('button', { name: 'לצילום התעודה' }).click();
    await expect(page.getByText(/ספרת ביקורת/)).toBeVisible();

    await idInput.fill('123456782');
    await page.getByRole('button', { name: 'לצילום התעודה' }).click();

    // Capture — take the upload fallback with the official specimen image.
    await expect(page.getByRole('button', { name: /צלמו/ })).toBeVisible();
    const specimen = path.join(__dirname, 'fixtures', 'tz_front.jpg');
    await page.locator('input[type=file]').setInputFiles(specimen);

    // On-device OCR (tesseract.js WASM) → review screen with derived dates.
    await expect(
      page.getByRole('heading', { name: 'אשרו את הפרטים' })
    ).toBeVisible({ timeout: 150_000 });

    // Specimen DOB is 04.04.1974; the ID number on it is intentionally
    // checksum-invalid, so the "manual review" badge is the honest outcome.
    await expect(page.getByLabel('תאריך לידה')).toHaveValue('1974-04-04');
    await expect(page.getByText('⧗ ייבדק ידנית')).toBeVisible();

    // Names prefilled from the profile.
    await expect(page.getByLabel('שם פרטי')).toHaveValue('בדיקה');
    await expect(page.getByLabel('שם משפחה')).toHaveValue('אוטומטית');

    // Continue into the selfie phase: human.js models load in-browser and the
    // observation loop runs. The fake camera feeds faceless frames, so the
    // honest outcome is the "lost you" recovery prompt — which proves the
    // face pipeline booted, detected nothing, and the liveness machine wired.
    await page.getByRole('button', { name: 'אישור והמשך לסלפי' }).click();
    await expect(
      page.getByRole('heading', { name: 'סלפי קצר לאימות' })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'נסו שוב' })).toBeVisible({
      timeout: 120_000, // model warmup + MAX_MISSING_FRAMES of empty frames
    });
  });
});
