import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { convergeService } from '@/services/converge';

// Rate limiting: store timestamps per IP (in production use Redis)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];

  // Filter out timestamps outside the window
  const recentTimestamps = timestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
  );

  if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  // Add current timestamp
  recentTimestamps.push(now);
  rateLimitMap.set(ip, recentTimestamps);

  return false;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the newsletter
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || 'unknown';

    // Rate limiting check
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { message: 'יותר מדי בקשות. נסו שוב מאוחר יותר.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { message: 'נא להזין כתובת אימייל' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!validateEmail(trimmedEmail)) {
      return NextResponse.json(
        { message: 'נא להזין כתובת אימייל תקינה' },
        { status: 400 }
      );
    }

    // Store subscription in Converge
    try {
      await convergeService.createNewsletterSubscription({
        email: trimmedEmail,
        subscribedAt: new Date(),
        source: 'website_homepage',
        status: 'active',
      });
    } catch (error) {
      // Check if already subscribed (duplicate key error)
      if (error instanceof Error && error.message.includes('duplicate')) {
        return NextResponse.json(
          { message: 'כתובת האימייל כבר רשומה לעדכונים' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(
      { message: 'נרשמתם בהצלחה לעדכונים!' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { message: 'שגיאה בהרשמה. נסו שוב מאוחר יותר.' },
      { status: 500 }
    );
  }
}
