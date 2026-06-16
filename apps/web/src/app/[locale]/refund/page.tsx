import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'מדיניות החזרים | תַּרְאוּ',
  description: 'מדיניות ההחזרים עבור תשלומי השתתפות ויצירת הצבעות בתַּרְאוּ.',
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

const LAST_UPDATED = '2026-06-13';

function content(locale: Locale): { title: string; intro: string; updated: string; sections: LegalSection[] } {
  if (locale === 'en') {
    return {
      title: 'Refund Policy',
      intro:
        'This policy explains when payments for civic participation on Taro can be refunded. Payments are processed by Paddle.com (Merchant of Record).',
      updated: `Last updated: ${LAST_UPDATED}`,
      sections: [
        {
          heading: '1. What You Are Paying For',
          paragraphs: [
            'Vote participation (₪3) records your vote with blockchain verification. Vote creation (₪50) publishes a new vote. These are digital civic actions delivered immediately.',
          ],
        },
        {
          heading: '2. When You Can Get a Refund',
          bullets: [
            'If a technical error charged you but your vote was not recorded, or you were charged more than once for the same action — you are entitled to a full refund.',
            'A vote-creation payment is refundable if the vote was not published due to a failure on our side.',
            'Requests made within 14 days of payment will be reviewed in line with applicable consumer-protection law.',
          ],
        },
        {
          heading: '3. When Refunds Are Not Available',
          paragraphs: [
            'Once a vote participation has been successfully recorded on the blockchain, or once a created vote has been published and its funds accrued toward seeding the vote’s BAG (its bags.fm memecoin), the action is final and generally non-refundable, because the service was delivered.',
          ],
        },
        {
          heading: '4. How to Request a Refund',
          paragraphs: [
            'Email support@taruu.co.il with your payment/transaction id (from your Paddle receipt) and a short description. Because Paddle is the Merchant of Record, refunds are issued back to your original payment method via Paddle, typically within 5–10 business days.',
          ],
        },
        {
          heading: '5. Contact',
          paragraphs: ['Refund requests: support@taruu.co.il'],
        },
      ],
    };
  }

  return {
    title: 'מדיניות החזרים',
    intro:
      'מדיניות זו מסבירה מתי ניתן להחזיר תשלומים עבור השתתפות אזרחית בתַּרְאוּ. התשלומים מעובדים על ידי Paddle.com (Merchant of Record).',
    updated: `עודכן לאחרונה: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. עבור מה אתם משלמים',
        paragraphs: [
          'השתתפות בהצבעה (₪3) מתעדת את הצבעתכם עם אימות בלוקצ׳יין. יצירת הצבעה (₪50) מפרסמת הצבעה חדשה. אלו פעולות אזרחיות דיגיטליות הניתנות באופן מיידי.',
        ],
      },
      {
        heading: '2. מתי ניתן לקבל החזר',
        bullets: [
          'אם תקלה טכנית חייבה אתכם אך ההצבעה לא תועדה, או אם חויבתם יותר מפעם אחת על אותה פעולה — אתם זכאים להחזר מלא.',
          'תשלום עבור יצירת הצבעה יוחזר אם ההצבעה לא פורסמה עקב כשל מצדנו.',
          'בקשות שיוגשו בתוך 14 ימים מהתשלום ייבחנו בהתאם לחוק הגנת הצרכן.',
        ],
      },
      {
        heading: '3. מתי לא ניתן החזר',
        paragraphs: [
          'לאחר שהשתתפות בהצבעה תועדה בהצלחה על גבי הבלוקצ׳יין, או לאחר שהצבעה שנוצרה פורסמה וכספיה נצברו לטובת זריעת ה-BAG (המטבע ב-bags.fm) של ההצבעה — הפעולה סופית ואינה ניתנת להחזר ככלל, מאחר שהשירות סופק.',
        ],
      },
      {
        heading: '4. כיצד לבקש החזר',
        paragraphs: [
          'שלחו דוא״ל לכתובת support@taruu.co.il עם מזהה התשלום/העסקה (מתוך קבלת Paddle) ותיאור קצר. מאחר ש-Paddle היא הסוחר הרשום, ההחזרים מתבצעים לאמצעי התשלום המקורי דרך Paddle, בדרך כלל בתוך 5–10 ימי עסקים.',
        ],
      },
      {
        heading: '5. יצירת קשר',
        paragraphs: ['בקשות החזר: support@taruu.co.il'],
      },
    ],
  };
}

export default async function RefundPage({ params }: PageProps) {
  const { locale } = await params;
  const c = content(locale);
  return <LegalPage locale={locale} title={c.title} intro={c.intro} updated={c.updated} sections={c.sections} />;
}
