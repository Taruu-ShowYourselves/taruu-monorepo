/**
 * Issue #75's screenshot evidence, captured against a live database.
 *
 * Every other test in this phase runs under `vitest` with `environment: 'node'`
 * and Supabase fully mocked, so nothing in the suite has ever rendered a pixel
 * or executed a query. This spec is the one place both happen at once: it signs
 * in as a seeded admin, walks the six surfaces, asserts the state each frame is
 * supposed to depict, and only then takes the picture.
 *
 * THE ASSERTION IS THE EVIDENCE, NOT THE IMAGE. A screenshot of the wrong state
 * is worse than no screenshot, because it looks like proof. Every frame below
 * asserts the specific thing the UI-SPEC's screenshot table says it must show
 * before `page.screenshot` is reached, so a frame can only be written if it
 * depicts what it claims to.
 *
 * ---------------------------------------------------------------------------
 * Running it
 * ---------------------------------------------------------------------------
 *
 *   1. Bring up a local Supabase with the migrations applied and seeding
 *      disabled (`supabase/seed.sql` is broken — see the fixture's header).
 *   2. Apply `tests/e2e/fixtures/space-admin-seed.sql`.
 *   3. Point `apps/web/.env.local` at that stack and start `next dev`.
 *   4. Run:
 *
 *        SPACE_ADMIN_E2E_JWT_SECRET=<the app's JWT_SECRET> \
 *        PLAYWRIGHT_BASE_URL=http://127.0.0.1:3999 \
 *        pnpm --filter @sync/web exec playwright test tests/e2e/space-admin.spec.ts
 *
 * Without the secret, or against a server with no seeded space, the whole file
 * skips with a message rather than failing — `pnpm --filter @sync/web test:e2e`
 * must stay green on a machine with no local Supabase.
 */

import { expect, test, type Page, type Locator } from '@playwright/test';
import { SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// The seeded world. Every id here comes from
// `tests/e2e/fixtures/space-admin-seed.sql` and nothing else.
// ---------------------------------------------------------------------------

/** The administered space. The admin holds ten of the eleven capabilities. */
const SPACE_A = 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8';
/** A real space the admin holds NO grant in. */
const SPACE_B = 'd1d11bb8-de95-4b00-8f41-1178d9c69c9d';
/** `notification_monthly_quota = 1`, one campaign already sent this month. */
const SPACE_C = '3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7';

const SPACE_A_NAME = 'קריית טבעון';
const SPACE_B_NAME = 'רעננה';

/** Under review, submitted by someone else, unmoderated. Frame 16a. */
const PROPOSAL_OPEN = '00000000-0000-4000-8000-051600000201';
const PROPOSAL_OPEN_TITLE = 'הרחבת שביל האופניים ברחוב הראשי';
/** Under review, submitted by the viewing admin. Frames 3-4. */
const PROPOSAL_SELF_TITLE = 'הצבת ספסלים מוצלים בגן הוותיקים';
/** Under review, hidden AND flagged. Frame 16b. */
const PROPOSAL_MODERATED = '00000000-0000-4000-8000-051600000203';

const SUSPENDED_MEMBER_NAME = 'איתי כהן';

const ACCOUNTS = {
  /** Ten capabilities in space A, `notification.send` in space C. */
  admin: {
    userId: '00000000-0000-4000-8000-051600000001',
    googleId: 'gid-0516-a1',
    did: 'did:taruu:0516a1',
    email: 'space-admin-a@example.test',
  },
  /** `metrics.read` and nothing else, in space A. Frame 15. */
  metricsOnly: {
    userId: '00000000-0000-4000-8000-051600000002',
    googleId: 'gid-0516-a2',
    did: 'did:taruu:0516a2',
    email: 'space-admin-m@example.test',
  },
} as const;

const SECRET = process.env.SPACE_ADMIN_E2E_JWT_SECRET ?? process.env.JWT_SECRET ?? '';

// ---------------------------------------------------------------------------
// Frame numbering
// ---------------------------------------------------------------------------

/**
 * The UI-SPEC numbers the six surfaces as desktop/mobile PAIRS (1-2 overview,
 * 3-4 proposals, …) and the five state frames as singles. `frame()` picks the
 * right number for whichever viewport project is running, so the filenames on
 * disk line up with the spec's own table rather than with test order.
 */
const FRAME_NUMBERS: Record<string, readonly [string, string]> = {
  overview: ['01', '02'],
  proposals: ['03', '04'],
  members: ['05', '06'],
  stats: ['07', '08'],
  dispatch: ['09', '10'],
  audit: ['11', '12'],
  'irreversible-dialog': ['13', '13'],
  'quota-exhausted': ['14', '14'],
  'no-permission': ['15', '15'],
  'detail-unmoderated': ['16a', '16a'],
  'detail-hidden-flagged': ['16b', '16b'],
};

const isMobile = (projectName: string): boolean => projectName.startsWith('mobile');

const SHOT_DIR = 'tests/e2e/__screenshots__/space-admin';

/**
 * Full-page by default. The evidence has to include things that sit below the
 * fold at 900px — the statistics footer note, the audit pagination — and a
 * viewport crop would silently drop exactly the elements the frame is supposed
 * to prove. `fullPage: false` is passed only for the modal frame, where the
 * plate is fixed-position and a stitched full-page capture is meaningless.
 */
async function shot(page: Page, key: string, projectName: string, fullPage = true) {
  const [desktop, mobile] = FRAME_NUMBERS[key];
  const n = isMobile(projectName) ? mobile : desktop;
  const suffix = isMobile(projectName) ? 'mobile' : 'desktop';
  await page.screenshot({ path: `${SHOT_DIR}/${n}-${key}-${suffix}.png`, fullPage });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

async function mintSession(account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  return new SignJWT({ ...account })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    .setSubject(account.userId)
    .sign(new TextEncoder().encode(SECRET));
}

async function signIn(
  page: Page,
  baseURL: string,
  which: keyof typeof ACCOUNTS = 'admin'
) {
  const token = await mintSession(ACCOUNTS[which]);
  const { hostname } = new URL(baseURL);
  await page.context().addCookies([
    { name: 'sync-session', value: token, domain: hostname, path: '/' },
  ]);
}

/**
 * A surface is "settled" when its own content is on screen, never after a
 * fixed wait. Every space-admin page renders the masthead headline as its `h1`,
 * so that heading is the one stable signal shared by all six.
 */
async function awaitSurface(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** rgb()/rgba() → a comparable "r,g,b" string, so `#F4F1E8` and `rgb(244, 241, 232)` compare. */
const rgb = (value: string): string =>
  (value.match(/\d+/g) ?? []).slice(0, 3).join(',');

const hexToRgb = (hex: string): string => {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
};

// ---------------------------------------------------------------------------

test.describe('space-admin evidence frames (issue #75)', () => {
  test.beforeAll(async ({ request, baseURL }) => {
    test.skip(
      SECRET === '',
      'SPACE_ADMIN_E2E_JWT_SECRET is not set — no seeded space-admin environment. See this file’s header.'
    );

    const probe = await request
      .get(`${baseURL}/api/space-admin/${SPACE_A}`)
      .catch(() => null);
    test.skip(
      probe === null || probe.status() === 500 || probe.status() === 404,
      `No seeded space-admin environment at ${baseURL} — apply tests/e2e/fixtures/space-admin-seed.sql first.`
    );
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await signIn(page, baseURL!);

    /**
     * The site-wide `GeoGate` is a modal that asks a reader which town they
     * are in, and it opens for anyone with no stored locality. It is rendered
     * by `[locale]/layout.tsx`, so it sits over the space-admin console too and
     * would both intercept every click and appear in every frame.
     *
     * Storing a locality is what a returning reader already has, so setting it
     * here reproduces the ordinary state rather than suppressing a component.
     *
     * Worth knowing while reading this: the gate's own escape hatch is
     * `isAuthenticated` from the CLIENT auth store, which is populated by the
     * sign-in flow — not by the httpOnly session cookie. A session minted the
     * way this spec mints one is authenticated to the server and anonymous to
     * that store, which is why the cookie alone does not close the gate.
     */
    await page.addInitScript(() => {
      window.localStorage.setItem('taruu.municipality', 'קריית טבעון');
    });
  });

  // -------------------------------------------------------------------------
  // Frames 1-2 — Overview
  // -------------------------------------------------------------------------
  test('frames 1-2 · overview: populated figures and a withheld capability row', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}`);
    await awaitSurface(page);

    // Populated, not empty: every figure the admin may see carries a number.
    await expect(page.getByText('הצעות ממתינות להכרעה')).toBeVisible();
    await expect(page.getByText('חברים במרחב', { exact: true })).toBeVisible();

    // The manifest must show at least one capability the admin does NOT hold —
    // the seed withholds `grant.revoke` for exactly this frame. The glyph is
    // aria-hidden and the Hebrew word carries the meaning, so the word is what
    // is asserted.
    const withheld = page.getByText('לא מוענק');
    await expect(withheld.first()).toBeVisible();
    expect(await withheld.count()).toBeGreaterThanOrEqual(1);

    await shot(page, 'overview', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frames 3-4 — Proposals
  // -------------------------------------------------------------------------
  test('frames 3-4 · proposals: three rows, and the self-submitted row is locked with no buttons', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/proposals`);
    await awaitSurface(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);

    // At least one row under review.
    await expect(page.getByText('בבדיקה').first()).toBeVisible();

    // The self-submitted row: the lock text occupies the actions cell, and that
    // cell holds no control at all. Absence, not a disabled button — Rule A.
    const selfRow = page.locator('tbody tr', { hasText: PROPOSAL_SELF_TITLE }).first();
    const actionsCell = selfRow.locator('td[data-col="actions"]');
    await expect(actionsCell).toContainText(
      'הצעה שהגשתם — ההכרעה שמורה למנהל אחר.'
    );
    expect(await actionsCell.locator('button').count()).toBe(0);

    await shot(page, 'proposals', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frames 5-6 — Members
  // -------------------------------------------------------------------------
  test('frames 5-6 · members: a suspended row offers reinstatement and nothing else', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/members`);
    await awaitSurface(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);

    const suspended = page
      .locator('tbody tr', { hasText: SUSPENDED_MEMBER_NAME })
      .first();
    await expect(suspended).toContainText('מושעה/ית');
    await expect(suspended.getByRole('button', { name: 'ביטול השעיה' })).toBeVisible();
    // Changing the capabilities of someone who cannot act is meaningless, so
    // the grant editor is absent from a suspended row rather than disabled.
    expect(await suspended.getByText('ניהול הרשאות').count()).toBe(0);

    await shot(page, 'members', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frames 7-8 — Statistics
  // -------------------------------------------------------------------------
  test('frames 7-8 · statistics: a suppressed bucket, and nothing on the surface is clickable', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/stats`);
    await awaitSurface(page);

    // The seed gives space A four residents, which is inside the k-anonymity
    // floor, so the database itself withholds the number and the card renders
    // the bound instead.
    await expect(page.getByText('<5').first()).toBeVisible();
    await expect(page.getByText('מוסתר — קבוצה קטנה מדי').first()).toBeVisible();
    await expect(
      page.getByText(
        'כל המספרים כאן מצטברים. אין בלוח הזה פילוח או צפייה ברמת תושב יחיד — לא במסך ולא ב־API שמאחוריו.'
      )
    ).toBeVisible();

    // SPACE-07 in one assertion: no figure is a door to a breakdown. A control
    // anywhere inside a stat card would be step one of a drill-down.
    const interactiveInCards = await page
      .locator('[class*="statCard"]')
      .locator('a, button, [role=button], input, select')
      .count();
    expect(interactiveInCards).toBe(0);

    await shot(page, 'stats', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frames 9-10 — Dispatch
  // -------------------------------------------------------------------------
  test('frames 9-10 · dispatch: a costed audience, all four receipt rows, send enabled', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/dispatch`);
    await awaitSurface(page);

    await page.getByLabel('כותרת ההתראה').fill('עדכון לתושבי המרחב');
    await page
      .getByLabel('גוף ההודעה')
      .fill('ההצבעה על תוספת התאורה בשביל הכניסה לבית הספר נפתחה ותהיה פתוחה עשרים יום.');
    await page.getByLabel('קהל יעד').selectOption('all_members');

    await page.getByRole('button', { name: 'חשבו קהל יעד' }).click();

    // All four rows render unconditionally, zeros included — a dropped row does
    // not read as "zero", it reads as "not checked".
    for (const label of [
      'נמענים מאושרים',
      'הוחרגו — ביטלו הסכמה',
      'הוחרגו — ללא ערוץ פעיל',
      'מכסה חודשית',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    const send = page.getByRole('button', { name: 'שלחו התראה', exact: true });
    await expect(send).toBeVisible();
    await expect(send).toBeEnabled();

    await shot(page, 'dispatch', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frames 11-12 — Audit
  // -------------------------------------------------------------------------
  test('frames 11-12 · audit: five or more rows, an expanded reason, and live pagination', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/audit`);
    await awaitSurface(page);

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);

    // The seed's over-long suspension reason is what the clamp has to clamp.
    // The trigger is located through its OWN row rather than by `.first()`:
    // expanding renames the button to `הסתר`, so a name-based locator would
    // silently re-resolve to the next row's still-collapsed trigger. The label
    // itself changes with the width — one of the two is `display: none` per
    // breakpoint, so only one is ever in the accessibility tree.
    const longRow = page
      .locator('tbody tr', { hasText: 'השעיה בעקבות הפרה חוזרת' })
      .first();
    await longRow
      .getByRole('button', { name: /הצג נימוק מלא|הצג פרטים/ })
      .click();
    // The expansion is a sibling `<tr>`, so the disclosed text is asserted on
    // the page rather than inside the row that triggered it — and specifically
    // on the expansion's own paragraph, because the clamped cell above still
    // holds the same characters in the DOM.
    const fullReason = page.locator('p[class*="fullReason"]');
    await expect(fullReason).toBeVisible();
    await expect(fullReason).toContainText('ההודעות שהובילו להחלטה תועדו בצילומי מסך');

    // The fixture writes 105 rows against a served page of 100, so "older
    // records" is a live control rather than a permanently disabled one.
    const older = page.getByRole('button', { name: /רשומות ישנות יותר/ });
    await expect(older).toBeVisible();
    await expect(older).toBeEnabled();

    await shot(page, 'audit', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frame 13 — the irreversible dialog
  // -------------------------------------------------------------------------
  test('frame 13 · the approve dialog: confirm is visibly disabled and does not invert on hover', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/proposals`);
    await awaitSurface(page);

    const row = page.locator('tbody tr', { hasText: PROPOSAL_OPEN_TITLE }).first();
    await row.getByRole('button', { name: 'אישור ופרסום' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('פעולה בלתי הפיכה · IRREVERSIBLE');

    const reason = dialog.locator('textarea');
    await expect(reason).toBeVisible();
    // Focus lands in the reason field, never on the confirm button.
    await expect(reason).toBeFocused();

    // The dialog's confirm carries the ACTION VERB (`אשרו ופרסמו`), never the
    // row trigger's noun phrase and never a bare `אישור` — the copy deck's
    // rule, and the reason the two names differ.
    const confirm = dialog.getByRole('button', { name: 'אשרו ופרסמו' });
    await expect(confirm).toBeDisabled();
    const disabledBg = await confirm.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );

    // Hovering a disabled control must not repaint it. This is the detail most
    // likely to have lost silently on CSS specificity, which is why it is
    // measured rather than eyeballed.
    await confirm.hover({ force: true });
    const hoveredBg = await confirm.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(rgb(hoveredBg)).toBe(rgb(disabledBg));

    // Park the pointer before the next reading. Chromium keeps `:hover` on the
    // element the mouse last rested over, and the confirm's enabled hover state
    // is a THIRD appearance (D23's red-dark fill) — measuring it here would
    // compare the wrong pair.
    await page.mouse.move(0, 0);

    // …and the same button, once enabled, must look different. Comparing one
    // control in its two states is what proves the disabled appearance landed
    // rather than being the component's ordinary paint.
    await reason.fill('ההצעה עומדת בתנאי הפרסום ואושרה בישיבת הוועדה.');
    await expect(confirm).toBeEnabled();
    await expect
      .poll(() => confirm.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(disabledBg);

    // Back to the state the frame must depict.
    await reason.fill('');
    await expect(confirm).toBeDisabled();
    await expect
      .poll(() => confirm.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(disabledBg);

    await shot(page, 'irreversible-dialog', testInfo.project.name, false);
  });

  // -------------------------------------------------------------------------
  // Frame 14 — the exhausted quota
  // -------------------------------------------------------------------------
  test('frame 14 · exhausted quota: no send control exists and the kicker is paper on ink', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_C}/dispatch`);
    await awaitSurface(page);

    const quotaKicker = page.getByText('מכסה מוצתה · QUOTA');
    await expect(quotaKicker).toBeVisible();

    // Rule A, not Rule B: nothing the admin can type unblocks a spent quota, so
    // the control is absent rather than disabled-with-a-hint.
    expect(await page.getByRole('button', { name: 'שלחו התראה' }).count()).toBe(0);

    // D16: there is no red that clears AA as text on the ink block, so the
    // kicker's own text is the paper token and only the tick glyph is red.
    const paperToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--np-paper')
    );
    const kickerColor = await quotaKicker.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(rgb(kickerColor)).toBe(hexToRgb(paperToken));

    await shot(page, 'quota-exhausted', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frame 15 — no permission
  // -------------------------------------------------------------------------
  test('frame 15 · no permission: the refusal is coherent, and a zero-grant admin is told nothing', async ({
    page,
    baseURL,
  }, testInfo) => {
    // A member of the space who holds `metrics.read` and nothing else. The page
    // stays whole — masthead, nav, footer — and the surface itself refuses.
    await page.context().clearCookies();
    await signIn(page, baseURL!, 'metricsOnly');

    await page.goto(`/he/space-admin/${SPACE_A}/proposals`);
    await awaitSurface(page);

    await expect(page.getByText('אין הרשאה · NO ACCESS')).toBeVisible();
    await expect(page.getByRole('button', { name: 'פנייה למנהל־על' })).toBeVisible();

    await shot(page, 'no-permission', testInfo.project.name);

    // The other half of the same guarantee: an admin holding NOTHING in a space
    // must not learn its name from the page that refused them. A refusal that
    // named the space would answer the question it is withholding.
    await page.context().clearCookies();
    await signIn(page, baseURL!, 'admin');
    await page.goto(`/he/space-admin/${SPACE_B}`);
    await expect(page.getByText('אין הרשאה · NO ACCESS')).toBeVisible();
    expect(await page.getByText(SPACE_B_NAME).count()).toBe(0);
    expect(await page.getByText(SPACE_A_NAME).count()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Frame 16a — the detail panel, unmoderated
  // -------------------------------------------------------------------------
  test('frame 16a · detail panel reached by deep link, with both forward content controls', async ({
    page,
  }, testInfo) => {
    await page.goto(`/he/space-admin/${SPACE_A}/proposals?proposal=${PROPOSAL_OPEN}`);
    await awaitSurface(page);

    const panel = page.locator('tbody tr td[colspan]').first();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText(
      PROPOSAL_OPEN_TITLE
    );

    await expect(panel.getByRole('button', { name: 'הסתרת תוכן' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'סימון לבדיקה' })).toBeVisible();
    // The inverses belong to frame 16b; hide/unhide are mutually exclusive, so
    // no single panel can carry both.
    expect(await panel.getByRole('button', { name: 'ביטול הסתרה' }).count()).toBe(0);

    await shot(page, 'detail-unmoderated', testInfo.project.name);
  });

  // -------------------------------------------------------------------------
  // Frame 16b — the detail panel, hidden AND flagged
  // -------------------------------------------------------------------------
  test('frame 16b · detail panel for hidden-and-flagged content, hidden notice first', async ({
    page,
  }, testInfo) => {
    await page.goto(
      `/he/space-admin/${SPACE_A}/proposals?proposal=${PROPOSAL_MODERATED}`
    );
    await awaitSurface(page);

    const panel = page.locator('tbody tr td[colspan]').first();
    await expect(panel).toBeVisible();

    const notices: Locator = panel.locator('p', { hasText: 'התוכן' });
    await expect(notices.first()).toContainText('התוכן מוסתר מתושבי המרחב');
    await expect(notices.nth(1)).toContainText('התוכן מסומן לבדיקה');

    await expect(panel.getByRole('button', { name: 'ביטול הסתרה' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'ביטול סימון' })).toBeVisible();
    expect(await panel.getByRole('button', { name: 'הסתרת תוכן' }).count()).toBe(0);
    expect(await panel.getByRole('button', { name: 'סימון לבדיקה' }).count()).toBe(0);

    await shot(page, 'detail-hidden-flagged', testInfo.project.name);
  });
});
