import { NextRequest, NextResponse } from 'next/server';

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/newsletter
 * Subscribe to newsletter via Beehiiv
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source = 'website', sourcePage } = body;

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

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
      console.error('Beehiiv credentials not configured. API_KEY:', !!BEEHIIV_API_KEY, 'PUB_ID:', !!BEEHIIV_PUBLICATION_ID);
      return NextResponse.json(
        {
          success: false,
          message: 'שגיאת תצורה. אנא נסו שוב מאוחר יותר'
        },
        { status: 500 }
      );
    }

    console.log('Attempting Beehiiv subscription for:', normalizedEmail);

    // Subscribe to Beehiiv
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: source,
          utm_medium: 'website',
          utm_campaign: sourcePage || 'homepage',
          referring_site: sourcePage || 'https://taro.co.il',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Beehiiv API error:', data);

      // Check if already subscribed
      if (response.status === 409 || data?.message?.includes('already')) {
        return NextResponse.json({
          success: true,
          message: 'כתובת האימייל כבר רשומה לניוזלטר שלנו',
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: 'אירעה שגיאה. אנא נסו שוב מאוחר יותר'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'תודה! נרשמת בהצלחה לניוזלטר',
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
 * Get subscriber count from Beehiiv
 */
export async function GET() {
  try {
    if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) {
      return NextResponse.json(
        { error: 'Beehiiv not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error('Failed to fetch publication data');
    }

    return NextResponse.json({
      total: data.data?.total_subscriptions || 0,
      active: data.data?.active_subscriptions || 0,
    });
  } catch (error) {
    console.error('Error fetching newsletter stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
