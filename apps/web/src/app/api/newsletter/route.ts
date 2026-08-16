/**
 * The newsletter list, kept in our own database.
 *
 * This used to POST every signup to Beehiiv. Their key went dead and nobody
 * noticed, because the unit tests mock `fetch` and a mocked third party never
 * returns 401 - so for as long as the key was stale, every reader who handed
 * us an address got a generic apology and the address was dropped on the
 * floor. A list we cannot verify from CI is a list we do not have.
 *
 * There is one route now. The homepage footer used to post here (no rate
 * limit) and the marketing section posted to /api/newsletter/subscribe (rate
 * limited), which meant the busiest form was the unprotected one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { newsletterLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import type { Locale } from '@/lib/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Postgres unique_violation - the address is already on the list. */
const UNIQUE_VIOLATION = '23505';

type Copy = { invalid: string; ok: string; already: string; error: string; limited: string };

const COPY: Record<Locale, Copy> = {
  he: {
    invalid: 'כתובת אימייל לא תקינה',
    ok: 'תודה! נרשמתם בהצלחה לניוזלטר',
    already: 'כתובת האימייל כבר רשומה לניוזלטר שלנו',
    error: 'אירעה שגיאה. אנא נסו שוב מאוחר יותר',
    limited: 'יותר מדי בקשות. נסו שוב מאוחר יותר.',
  },
  en: {
    invalid: 'That email address is not valid',
    ok: 'Thank you - you are on the list',
    already: 'That address is already subscribed',
    error: 'Something went wrong. Please try again later',
    limited: 'Too many requests. Please try again later.',
  },
};

function copyFor(locale: unknown): Copy {
  return locale === 'en' ? COPY.en : COPY.he;
}

interface SubscribeBody {
  email?: unknown;
  source?: unknown;
  sourcePage?: unknown;
  locale?: unknown;
}

/**
 * POST /api/newsletter
 *
 * Always answers `{ success, message }`. An address already on the list is a
 * success as far as the reader is concerned - they asked to be subscribed and
 * they are - so it returns 200 rather than an error the form has to decode.
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const clientIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const rateLimit = await newsletterLimiter.check(clientIp);
    if (rateLimit.limited) {
      return createRateLimitResponse(rateLimit, COPY.he.limited);
    }

    const body = (await request.json()) as SubscribeBody;
    const t = copyFor(body.locale);

    if (typeof body.email !== 'string') {
      return NextResponse.json({ success: false, message: t.invalid }, { status: 400 });
    }

    // Normalised here, not in the database: the table CHECKs that what it
    // stores is already lowercase and trimmed.
    const email = body.email.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, message: t.invalid }, { status: 400 });
    }

    const source = typeof body.source === 'string' ? body.source.slice(0, 120) : null;
    const sourcePage =
      typeof body.sourcePage === 'string' ? body.sourcePage.slice(0, 200) : null;
    const locale = body.locale === 'en' || body.locale === 'he' ? body.locale : null;

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({ email, source, source_page: sourcePage, locale });

    if (!error) {
      return NextResponse.json({ success: true, message: t.ok }, { status: 201 });
    }

    if (error.code !== UNIQUE_VIOLATION) {
      console.error('Newsletter insert failed:', error.message);
      return NextResponse.json({ success: false, message: t.error }, { status: 500 });
    }

    // Already on the list. Reactivate if they had unsubscribed - the row is
    // kept precisely so a returning reader lands back on their own record.
    const { error: reviveError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .update({
        status: 'active',
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)
      .eq('status', 'unsubscribed');

    if (reviveError) {
      console.error('Newsletter reactivation failed:', reviveError.message);
    }

    return NextResponse.json({ success: true, message: t.already }, { status: 200 });
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json(
      { success: false, message: COPY.he.error },
      { status: 500 }
    );
  }
}

/**
 * GET /api/newsletter - list size, counted rather than reported by a vendor.
 */
export async function GET() {
  try {
    const [total, active] = await Promise.all([
      supabaseAdmin
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
    ]);

    if (total.error || active.error) {
      throw total.error ?? active.error;
    }

    return NextResponse.json({ total: total.count ?? 0, active: active.count ?? 0 });
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
