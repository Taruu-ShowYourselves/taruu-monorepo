import { expect, test, type Page } from '@playwright/test';
import type {
  CouncilMetric,
  PublicCouncilProfile,
} from '@sync/shared/contracts';

const profile: PublicCouncilProfile = {
  council: {
    id: '2ec8fe4c-6dc4-4aa3-a785-1847dd70c213',
    code: 'קריית טבעון',
    name: 'קריית טבעון',
    slug: 'קריית-טבעון',
    canonicalUrl: '/he/councils/קריית-טבעון',
  },
  generatedAt: '2026-07-30T08:00:00.000Z',
  metrics: {
    officialPopulation: {
      value: 18697,
      status: 'stale',
      definition: 'אוכלוסייה רשמית',
      source: {
        name: 'הלשכה המרכזית לסטטיסטיקה',
        url: 'https://www.cbs.gov.il/example.pdf',
        asOf: '2023-12-31',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    },
    registeredUsers: metric(25, 'משתמשים רשומים'),
    communityManagers: metric(2, 'מנהלים פעילים'),
    payingUsers: metric(7, 'משלמים'),
    relevantVotes: metric(4, 'הצבעות'),
    activeVotes: metric(1, 'פעילות'),
  },
  links: {
    votes: '/he/votes?municipality=%D7%A7%D7%A8%D7%99%D7%99%D7%AA%20%D7%98%D7%91%D7%A2%D7%95%D7%9F',
    civicSpace:
      '/he/municipality/%D7%A7%D7%A8%D7%99%D7%99%D7%AA%20%D7%98%D7%91%D7%A2%D7%95%D7%9F',
  },
};

function metric(value: number, definition: string): CouncilMetric {
  return {
    value,
    status: 'available',
    definition,
    source: {
      name: 'מסד הנתונים של תַּרְאוּ',
      url: null,
      asOf: '2026-07-30T08:00:00.000Z',
      updatedAt: '2026-07-30T08:00:00.000Z',
    },
  };
}

async function mockCouncil(page: Page, body: unknown, status = 200) {
  await page.route('**/api/councils/**', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  );
}

test('populated stale council is readable on desktop and canonicalizes aliases', async ({
  page,
}) => {
  await mockCouncil(page, profile);
  await page.goto('/he/councils/קרית%20טבעון');

  await expect(page.getByRole('heading', { name: 'קריית טבעון' })).toBeVisible();
  await expect(page.getByText('18,697')).toBeVisible();
  await expect(page.getByText('דורש רענון')).toBeVisible();
  await expect(page).toHaveURL(/\/he\/councils\/(?:קריית-טבעון|%D7)/);

  const definition = page.getByText('איך הנתון מחושב?').first();
  await definition.focus();
  await expect(definition).toBeFocused();
});

test('empty council has a meaningful mobile state without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const emptyProfile = structuredClone(profile);
  emptyProfile.metrics.registeredUsers = metric(0, 'משתמשים רשומים');
  emptyProfile.metrics.communityManagers = metric(0, 'מנהלים פעילים');
  emptyProfile.metrics.payingUsers = metric(0, 'משלמים');
  emptyProfile.metrics.relevantVotes = metric(0, 'הצבעות');
  emptyProfile.metrics.activeVotes = metric(0, 'פעילות');
  await mockCouncil(page, emptyProfile);

  await page.goto('/he/councils/קריית-טבעון');

  await expect(
    page.getByRole('heading', { name: 'הקהילה המקומית עוד לא התחילה לפעול' })
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  ).toBe(true);
});

test('missing official source and API failure are explicit', async ({ page }) => {
  const missingSource = structuredClone(profile);
  missingSource.metrics.officialPopulation = {
    value: null,
    status: 'unavailable',
    definition: 'אוכלוסייה רשמית',
    source: null,
  };
  await mockCouncil(page, missingSource);
  await page.goto('/he/councils/קריית-טבעון');
  await expect(page.getByText('מקור מלא טרם פורסם.')).toBeVisible();

  await page.unroute('**/api/councils/**');
  await mockCouncil(page, { error: 'Internal server error' }, 500);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'הנתונים אינם זמינים כרגע' })
  ).toBeVisible();
});
