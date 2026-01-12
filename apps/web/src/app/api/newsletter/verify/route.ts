import { NextRequest, NextResponse } from 'next/server';
import { convergeService } from '@/services/converge';
import { emailService } from '@/services/email';

/**
 * GET /api/newsletter/verify?token=xxx
 * Verify newsletter subscription via token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'טוקן אימות חסר'
        },
        { status: 400 }
      );
    }

    const signup = await convergeService.getNewsletterSignupByToken(token);

    if (!signup) {
      return NextResponse.json(
        {
          success: false,
          message: 'טוקן לא תקין או שפג תוקפו'
        },
        { status: 404 }
      );
    }

    if (signup.status === 'verified') {
      return NextResponse.json({
        success: true,
        message: 'כתובת האימייל כבר אומתה',
      });
    }

    await convergeService.verifyNewsletterSignup(signup.id);

    await emailService.sendNewsletterWelcomeEmail({
      to: signup.email,
    });

    return NextResponse.json({
      success: true,
      message: 'תודה! נרשמת בהצלחה לניוזלטר שלנו',
    });

  } catch (error) {
    console.error('Newsletter verification error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'אירעה שגיאה באימות. אנא נסו שוב'
      },
      { status: 500 }
    );
  }
}
