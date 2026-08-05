/**
 * E2E - vote detail page renders for real votes (regression).
 *
 * Guards the API↔page contract: the detail route returns
 * `{ vote: { options: [{label/voteCount + text/votes aliases}] } }`, and a
 * shape drift once crashed every vote click with reduce-on-undefined
 * (the Knesset-desk "clicking items errors" bug).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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

const vars = { ...parseEnvFile('.dev.vars'), ...parseEnvFile('.env.local') };

test('a live vote page renders title, options and no client crash', async ({ page }) => {
  const db = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);
  const { data: votes } = await db
    .from('votes')
    .select('id, title')
    .eq('status', 'active')
    .limit(1);
  test.skip(!votes?.length, 'no active votes in this environment');

  const vote = votes![0];
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(`/he/votes/${vote.id}`);

  // The crash manifested as Next's client-exception screen.
  await expect(
    page.getByText(/Application error/i)
  ).toHaveCount(0);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    vote.title.slice(0, 20),
    { timeout: 20000 }
  );

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('the API detail response carries the aliases the page consumes', async ({
  request,
}) => {
  const db = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);
  const { data: votes } = await db
    .from('votes')
    .select('id')
    .eq('status', 'active')
    .limit(1);
  test.skip(!votes?.length, 'no active votes in this environment');

  const res = await request.get(`/api/votes/${votes![0].id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.vote).toBeTruthy();
  expect(Array.isArray(body.vote.options)).toBe(true);
  for (const option of body.vote.options) {
    expect(typeof option.text).toBe('string');
    expect(typeof option.votes).toBe('number');
    expect(typeof option.label).toBe('string');
    expect(typeof option.voteCount).toBe('number');
  }
});
