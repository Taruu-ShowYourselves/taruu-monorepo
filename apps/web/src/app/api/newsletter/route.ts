import { NextRequest, NextResponse } from 'next/server';
import { convergeService } from '@/services/converge';
import { emailService } from '@/services/email';
import type { SignupSource } from '@/services/converge';

function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

const VALID_SOURCES: SignupSource[] = [
  'homepage_cta',
  'footer',
  'landing_page',
  'blog',
  'campaign',
  'other',
];

/**
 * POST /api/newsletter
 * Subscribe to newsletter with double opt-in
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source = 'other', sourcePage } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'כתובת אימייל נדרשת'
        },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          message: 'כתובת אימייל לא תקינה'
        },
        { status: 400 }
      );
    }

    const validSource: SignupSource = VALID_SOURCES.includes(source) ? source : 'other';

    const existingSignup = await convergeService.getNewsletterSignupByEmail(normalizedEmail);

    if (existingSignup) {
      if (existingSignup.status === 'verified') {
        return NextResponse.json({
          success: true,
          message: 'כתובת האימייל כבר רשומה לניוזלטר שלנו',
          requiresVerification: false,
        });
      }

      if (existingSignup.status === 'pending') {
        const newToken = generateVerificationToken();

        await convergeService.verifyNewsletterSignup(existingSignup.id);
        const updatedSignup = await convergeService.getNewsletterSignupByEmail(normalizedEmail);

        if (updatedSignup) {
          await emailService.sendNewsletterVerificationEmail({
            to: normalizedEmail,
            verificationToken: newToken,
          });
        }

        return NextResponse.json({
          success: true,
          message: 'שלחנו לך אימייל אימות חדש',
          requiresVerification: true,
        });
      }

      if (existingSignup.status === 'unsubscribed') {
        const newToken = generateVerificationToken();

        const newSignup = await convergeService.createNewsletterSignup({
          email: normalizedEmail,
          source: validSource,
          sourcePage,
          verificationToken: newToken,
        });

        await emailService.sendNewsletterVerificationEmail({
          to: normalizedEmail,
          verificationToken: newToken,
        });

        return NextResponse.json({
          success: true,
          message: 'שלחנו לך אימייל לאימות ההרשמה',
          requiresVerification: true,
        });
      }
    }

    const verificationToken = generateVerificationToken();

    await convergeService.createNewsletterSignup({
      email: normalizedEmail,
      source: validSource,
      sourcePage,
      verificationToken,
    });

    await emailService.sendNewsletterVerificationEmail({
      to: normalizedEmail,
      verificationToken,
    });

    return NextResponse.json({
      success: true,
      message: 'תודה! שלחנו לך אימייל לאימות ההרשמה',
      requiresVerification: true,
    }, { status: 201 });

  } catch (error) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'אירעה שגיאה. אנא נסו שוב מאוחר יותר'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/newsletter
 * Get all newsletter signups (admin only - would need auth in production)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'verified' | 'unsubscribed' | null;

    const signups = await convergeService.getAllNewsletterSignups(status || undefined);

    return NextResponse.json({
      signups,
      total: signups.length,
    });
  } catch (error) {
    console.error('Error fetching newsletter signups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signups' },
      { status: 500 }
    );
  }
}
