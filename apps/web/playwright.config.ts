import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      /* Specs that declare their own widths below must not also run at the
         default one — the space-admin evidence would write the same sixteen
         frames from a viewport nobody asked for, and the map's pin selection
         is a claim about named phone and desk widths, not about whatever the
         default happens to be. */
      testIgnore: /space-admin\.spec\.ts|israel-map-pins\.spec\.ts/,
    },

    /*
     * The two widths issue #75 asks the screenshot evidence to be captured at,
     * from `05-UI-SPEC.md`'s Responsive Contract. The project name is part of
     * every output filename, so a frame is self-describing on disk.
     */
    {
      name: 'desktop-1440x900',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /space-admin\.spec\.ts/,
    },
    {
      name: 'mobile-390x844',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
      testMatch: /space-admin\.spec\.ts/,
    },

    /*
     * The live map's pins are placed by geography, so how crowded they are
     * depends on how wide the country is drawn. These are the phone widths the
     * overlap was measured at plus the desk width, each with touch on: a tap
     * has to land on the town under the finger at every one of them.
     */
    {
      name: 'map-mobile-390x844',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: /israel-map-pins\.spec\.ts/,
    },
    {
      name: 'map-mobile-393x852',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 393, height: 852 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: /israel-map-pins\.spec\.ts/,
    },
    {
      name: 'map-mobile-430x932',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 932 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: /israel-map-pins\.spec\.ts/,
    },
    {
      name: 'map-desktop-1440x900',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /israel-map-pins\.spec\.ts/,
    },
  ],

  /* Run your local dev server before starting the tests.
     Skipped when PLAYWRIGHT_BASE_URL names a server that is already up — the
     space-admin evidence run points at a seeded instance on its own port, and
     starting a second `pnpm dev` would fight it for `.next`. */
  webServer: process.env.CI || process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
