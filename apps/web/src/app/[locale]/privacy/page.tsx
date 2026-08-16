import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

interface PrivacyCopy {
  title: string;
  /** English-only convenience notice rendered as the first line of the standfirst. */
  disclaimer?: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

const LAST_UPDATED = '2026-06-13';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'מדיניות פרטיות | תַּרְאוּ',
    description: 'כיצד תַּרְאוּ אוספת, משתמשת ומגינה על המידע האישי שלכם.',
  },
  en: {
    title: 'Privacy Policy | Taruu',
    description: 'How Taruu collects, uses, and protects your personal information.',
  },
};

const COPY: Record<Locale, PrivacyCopy> = {
  he: {
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
  },
  en: {
    title: 'Privacy Policy',
    disclaimer:
      'This English translation is provided for convenience only; the Hebrew original is the binding version.',
    intro:
      'This policy explains what personal data Taruu collects, how we use it, and with whom we share it.',
    updated: `Last updated: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. Information We Collect',
        bullets: [
          'Account and identity: name, email, and social sign-in (Google, Facebook, Instagram) used to compute the identity score.',
          'Location: GPS coordinates at the moment of voting, used solely to verify residence; stored as a hashed location proof (hash).',
          'Phone: phone number for SMS verification (via Twilio).',
          'Payments: processed by Green Invoice; we store a payment record and a transaction identifier only, not your credit card details.',
          'Voting activity: which votes you participated in.',
        ],
      },
      {
        heading: '2. How We Use Information',
        paragraphs: [
          'We use the information to verify eligibility, record votes, process payments, prevent fraud and double voting, send receipts and notifications, and operate the platform.',
        ],
      },
      {
        heading: '3. Service Providers',
        bullets: [
          'Supabase: database and authentication.',
          'Green Invoice: payment processing (Merchant of Record).',
          'bags.fm: BAG infrastructure (a bags.fm coin per vote) on the Solana network.',
          'Resend: transactional email.',
          'Twilio: SMS verification.',
          'Vercel: hosting.',
        ],
      },
      {
        heading: '4. Blockchain Data',
        paragraphs: [
          'Vote proofs and BAGS (bags.fm coins, one BAG per vote) are recorded on a public blockchain. These records are pseudonymous, public, and cannot be deleted.',
        ],
      },
      {
        heading: '5. Retention and Your Rights',
        paragraphs: [
          'We retain personal information only for as long as it is needed for the purposes above or as required by law. Subject to applicable law, you may request access to your personal information or its deletion by contacting us. Please note that records on the blockchain cannot be deleted.',
        ],
      },
      {
        heading: '6. Contact',
        paragraphs: ['Privacy requests: support@taruu.co.il'],
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

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = COPY[locale];
  const intro = t.disclaimer ? `${t.disclaimer} ${t.intro}` : t.intro;
  return <LegalPage locale={locale} title={t.title} intro={intro} updated={t.updated} sections={t.sections} />;
}
