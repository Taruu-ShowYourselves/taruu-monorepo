import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | תַּרְאוּ',
  description: 'כיצד תַּרְאוּ אוספת, משתמשת ומגינה על המידע האישי שלכם.',
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

const LAST_UPDATED = '2026-06-13';

function content(locale: Locale): { title: string; intro: string; updated: string; sections: LegalSection[] } {
  if (locale === 'en') {
    return {
      title: 'Privacy Policy',
      intro:
        'This policy explains what personal data Taro collects, how we use it, and who we share it with.',
      updated: `Last updated: ${LAST_UPDATED}`,
      sections: [
        {
          heading: '1. Data We Collect',
          bullets: [
            'Account & identity: name, email, and social sign-in (Google, Facebook, Instagram) used to compute your identity score.',
            'Location: GPS coordinates at the moment of voting, used only to verify residency; stored as a hashed location proof.',
            'Phone: phone number for SMS verification (via Twilio).',
            'Payments: handled by Green Invoice; we store a payment record and transaction id, not your card details.',
            'Voting activity: which votes you participated in (not your secret choice beyond what the protocol records).',
          ],
        },
        {
          heading: '2. How We Use Data',
          paragraphs: [
            'We use your data to verify eligibility, record votes, process payments, prevent fraud and double-voting, send receipts and notifications, and operate the platform.',
          ],
        },
        {
          heading: '3. Service Providers',
          bullets: [
            'Supabase: database and authentication.',
            'Green Invoice: payment processing (Merchant of Record).',
            'bags.fm: BAG memecoin infrastructure (the per-vote bags.fm token) on Solana.',
            'Resend: transactional email.',
            'Twilio: SMS verification.',
            'Vercel: hosting.',
          ],
        },
        {
          heading: '4. Blockchain Data',
          paragraphs: [
            'Vote proofs and BAGS (bags.fm memecoins, one BAG per vote) are recorded on public blockchains. On-chain records are pseudonymous, public, and cannot be deleted.',
          ],
        },
        {
          heading: '5. Retention & Your Rights',
          paragraphs: [
            'We retain personal data only as long as needed for the purposes above or as required by law. Subject to applicable law, you may request access to or deletion of your personal data by contacting us. Note that on-chain records cannot be erased.',
          ],
        },
        {
          heading: '6. Contact',
          paragraphs: ['Privacy requests: support@taruu.co.il'],
        },
      ],
    };
  }

  return {
    title: 'מדיניות פרטיות',
    intro: 'מדיניות זו מסבירה אילו נתונים אישיים תַּרְאוּ אוספת, כיצד אנו משתמשים בהם ועם מי אנו חולקים אותם.',
    updated: `עודכן לאחרונה: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. מידע שאנו אוספים',
        bullets: [
          'חשבון וזהות: שם, דוא״ל והתחברות חברתית (Google, Facebook, Instagram) המשמשים לחישוב ציון הזהות.',
          'מיקום: קואורדינטות GPS ברגע ההצבעה, המשמשות אך ורק לאימות מגורים; נשמרות כהוכחת מיקום מוצפנת (hash).',
          'טלפון: מספר טלפון לאימות ב-SMS (באמצעות Twilio).',
          'תשלומים: מעובדים על ידי Green Invoice; אנו שומרים רישום תשלום ומזהה עסקה בלבד, לא את פרטי כרטיס האשראי.',
          'פעילות הצבעה: באילו הצבעות השתתפתם.',
        ],
      },
      {
        heading: '2. כיצד אנו משתמשים במידע',
        paragraphs: [
          'אנו משתמשים במידע לאימות זכאות, תיעוד הצבעות, עיבוד תשלומים, מניעת הונאה והצבעה כפולה, שליחת קבלות והתראות, והפעלת הפלטפורמה.',
        ],
      },
      {
        heading: '3. ספקי שירות',
        bullets: [
          'Supabase: בסיס נתונים ואימות.',
          'Green Invoice: עיבוד תשלומים (Merchant of Record).',
          'bags.fm: תשתית ה-BAG (מטבע ב-bags.fm לכל הצבעה) על רשת Solana.',
          'Resend: דוא״ל טרנזקציוני.',
          'Twilio: אימות SMS.',
          'Vercel: אחסון.',
        ],
      },
      {
        heading: '4. מידע על הבלוקצ׳יין',
        paragraphs: [
          'הוכחות הצבעה ו-BAGS (מטבעות ב-bags.fm, BAG אחד לכל הצבעה) נרשמים על גבי בלוקצ׳יין ציבורי. רישומים אלה הם פסאודונימיים, ציבוריים ואינם ניתנים למחיקה.',
        ],
      },
      {
        heading: '5. שמירה וזכויותיכם',
        paragraphs: [
          'אנו שומרים מידע אישי רק כל עוד הוא נדרש למטרות שלעיל או כנדרש בחוק. בכפוף לדין החל, באפשרותכם לבקש גישה למידע האישי או מחיקתו על ידי פנייה אלינו. שימו לב כי רישומים על גבי הבלוקצ׳יין אינם ניתנים למחיקה.',
        ],
      },
      {
        heading: '6. יצירת קשר',
        paragraphs: ['בקשות פרטיות: support@taruu.co.il'],
      },
    ],
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const c = content(locale);
  return <LegalPage locale={locale} title={c.title} intro={c.intro} updated={c.updated} sections={c.sections} />;
}
