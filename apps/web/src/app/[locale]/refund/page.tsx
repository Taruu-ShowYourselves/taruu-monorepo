import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

interface RefundCopy {
  title: string;
  /** English-only convenience notice rendered as the first line of the standfirst. */
  disclaimer?: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

const LAST_UPDATED = '2026-07-29';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'מדיניות החזרים | תַּרְאוּ',
    description: 'מדיניות ההחזרים עבור תשלומי יצירת הצבעות בתַּרְאוּ.',
  },
  en: {
    title: 'Refund Policy | Taruu',
    description: 'The refund policy for vote-creation payments on Taruu.',
  },
};

const COPY: Record<Locale, RefundCopy> = {
  he: {
    title: 'מדיניות החזרים',
    intro:
      'מדיניות זו מסבירה מתי ניתן להחזיר תשלומים בתַּרְאוּ (יצירת הצבעות ורכישות בחנות). התשלומים מעובדים על ידי Green Invoice (Merchant of Record).',
    updated: `עודכן לאחרונה: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. עבור מה אתם משלמים',
        paragraphs: [
          'ההצבעה חינם. הפעולה היחידה בתשלום היא יצירת הצבעה (₪50): פעולה דיגיטלית שמפרסמת הצבעה חדשה באופן מיידי.',
        ],
      },
      {
        heading: '2. מתי ניתן לקבל החזר',
        bullets: [
          'אם תקלה טכנית חייבה אתכם בלי שהפעולה הושלמה, או אם חויבתם יותר מפעם אחת על אותה פעולה, אתם זכאים להחזר מלא.',
          'תשלום עבור יצירת הצבעה יוחזר אם ההצבעה לא פורסמה עקב כשל מצדנו.',
          'בקשות שיוגשו בתוך 14 ימים מהתשלום ייבחנו בהתאם לחוק הגנת הצרכן.',
        ],
      },
      {
        heading: '3. מתי לא ניתן החזר',
        paragraphs: [
          'לאחר שהצבעה שנוצרה פורסמה, הפעולה סופית ואינה ניתנת להחזר ככלל, מאחר שהשירות סופק.',
        ],
      },
      {
        heading: '4. כיצד לבקש החזר',
        paragraphs: [
          'שלחו דוא״ל לכתובת support@taruu.co.il עם מזהה התשלום/העסקה (מתוך קבלת Green Invoice) ותיאור קצר. מאחר ש-Green Invoice היא הסוחר הרשום, ההחזרים מתבצעים לאמצעי התשלום המקורי דרך Green Invoice, בדרך כלל בתוך 5–10 ימי עסקים.',
        ],
      },
      {
        heading: '5. יצירת קשר',
        paragraphs: ['בקשות החזר: support@taruu.co.il'],
      },
    ],
  },
  en: {
    title: 'Refund Policy',
    disclaimer:
      'This English translation is provided for convenience only; the Hebrew original is the binding version.',
    intro:
      'This policy explains when payments on Taruu (vote creation and store purchases) can be refunded. Payments are processed by Green Invoice (Merchant of Record).',
    updated: `Last updated: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. What You Are Paying For',
        paragraphs: [
          'Voting is free. The only paid action is creating a vote (₪50): a digital action that publishes a new vote immediately.',
        ],
      },
      {
        heading: '2. When You Can Receive a Refund',
        bullets: [
          'If a technical fault charged you without the action being completed, or if you were charged more than once for the same action, you are entitled to a full refund.',
          'A payment for creating a vote will be refunded if the vote was not published due to a failure on our side.',
          'Requests submitted within 14 days of payment will be reviewed in accordance with the Consumer Protection Law, 5741-1981.',
        ],
      },
      {
        heading: '3. When a Refund Is Not Available',
        paragraphs: [
          'Once a created vote has been published, the action is final and, as a rule, non-refundable, since the service has been provided.',
        ],
      },
      {
        heading: '4. How to Request a Refund',
        paragraphs: [
          'Send an email to support@taruu.co.il with the payment/transaction identifier (from your Green Invoice receipt) and a short description. Since Green Invoice is the Merchant of Record, refunds are made to the original payment method via Green Invoice, usually within 5–10 business days.',
        ],
      },
      {
        heading: '5. Contact',
        paragraphs: ['Refund requests: support@taruu.co.il'],
      },
    ],
  },
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function RefundPage({ params }: PageProps) {
  const { locale } = await params;
  const t = COPY[locale];
  const intro = t.disclaimer ? `${t.disclaimer} ${t.intro}` : t.intro;
  return <LegalPage locale={locale} title={t.title} intro={intro} updated={t.updated} sections={t.sections} />;
}
