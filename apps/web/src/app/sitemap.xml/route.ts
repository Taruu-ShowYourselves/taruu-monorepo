import { MERCH_CATALOG } from '@/lib/merch/catalog';
import { getActiveVotes } from '@/lib/supabase/db';
import { i18n, localePath } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

const SITE_URL = 'https://taruu.co.il';

/**
 * The sitemap robots.txt advertises, both editions in one file.
 *
 * A route handler rather than Next's `app/sitemap.ts` metadata convention: the
 * metadata route prerenders through the ROOT layout, and this app's root
 * layout deliberately renders no `<html>` (the `[locale]` layout owns the
 * document so it can set `lang`/`dir`). The convention cannot prerender
 * against that and fails the build looking for a pages-router `_document`.
 * Emitting the XML here sidesteps the machinery and costs only the
 * hand-written serialiser below.
 *
 * Refreshed on the desks' cadence: the vote rows come from the database, so a
 * sitemap pinned at build time would advertise the edition that was open on
 * deploy day.
 */
export const revalidate = 3600;

type ChangeFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface SitemapEntry {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
  lastModified?: string;
}

/**
 * Public routes only. Anything behind a session (dashboard, settings,
 * space-admin, the participation flow) or transactional (payments/return,
 * store/thank-you, sign-in, sign-up) is deliberately absent: a crawler
 * reaching it gets a redirect at best and a refusal at worst.
 */
const STATIC_PATHS: readonly Omit<SitemapEntry, 'lastModified'>[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/explore', priority: 0.9, changeFrequency: 'daily' },
  { path: '/feed', priority: 0.9, changeFrequency: 'daily' },
  { path: '/votes', priority: 0.9, changeFrequency: 'daily' },
  { path: '/knesset', priority: 0.9, changeFrequency: 'daily' },
  { path: '/votes/archive', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/coin', priority: 0.6, changeFrequency: 'daily' },
  { path: '/treasury', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/what-is-taruu', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/economics', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/download', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/store', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund', priority: 0.3, changeFrequency: 'yearly' },
];

/** Absolute URL of a path in one edition. Hebrew is unprefixed. */
const url = (locale: Locale, path: string) =>
  `${SITE_URL}${localePath(locale, path)}`;

/** Municipality names carry no XML metacharacters today; the vote ids do not either. Encoded anyway - a sitemap that breaks its own parser is worse than a missing row. */
const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * One `<url>` per path in the default locale, carrying every edition of that
 * path as an alternate. Google reads the alternates as one hreflang cluster,
 * so listing each locale as its own top-level entry would only repeat the
 * cluster per language. `x-default` points at Hebrew, which is what the root
 * serves.
 */
function urlNode({ path, priority, changeFrequency, lastModified }: SitemapEntry): string {
  const alternates = [...i18n.locales, 'x-default' as const]
    .map((tag) => {
      const target = tag === 'x-default' ? i18n.defaultLocale : (tag as Locale);
      return `    <xhtml:link rel="alternate" hreflang="${tag}" href="${xml(url(target, path))}" />`;
    })
    .join('\n');

  return [
    '  <url>',
    `    <loc>${xml(url(i18n.defaultLocale, path))}</loc>`,
    lastModified ? `    <lastmod>${xml(lastModified)}</lastmod>` : null,
    `    <changefreq>${changeFrequency}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alternates,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function GET(): Promise<Response> {
  // Degrades to the static edition when the database is unreachable - notably
  // at build-time prerender in CI, where the service-role key deliberately
  // does not exist (#39). A sitemap missing its vote rows is a smaller failure
  // than a route that cannot answer at all.
  const votes = await getActiveVotes().catch(() => []);

  const entries: SitemapEntry[] = [
    ...STATIC_PATHS,
    ...MERCH_CATALOG.map((product) => ({
      path: `/store/${product.slug}`,
      priority: 0.4,
      changeFrequency: 'monthly' as const,
    })),
    ...votes.map((vote) => ({
      path: `/votes/${vote.id}`,
      priority: 0.8,
      changeFrequency: 'hourly' as const,
      lastModified: vote.updated_at ?? vote.created_at ?? undefined,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(urlNode),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${revalidate}, stale-while-revalidate=86400`,
    },
  });
}
