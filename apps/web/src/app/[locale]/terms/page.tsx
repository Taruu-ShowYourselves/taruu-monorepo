import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

interface TermsCopy {
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
    title: 'תנאי שימוש | תַּרְאוּ',
    description: 'תנאי השימוש בפלטפורמת תַּרְאוּ, הצבעות אזרחיות לרשויות מקומיות בישראל.',
  },
  en: {
    title: 'Terms of Use | Taruu',
    description: 'The Terms of Use for the Taruu platform, civic voting for local authorities in Israel.',
  },
};

const COPY: Record<Locale, TermsCopy> = {
  he: {
    title: 'תנאי שימוש',
    intro:
      'תנאים אלה חלים על השימוש בפלטפורמת תַּרְאוּ ("תראו", "אנחנו"). השימוש בשירות מהווה הסכמה לתנאים.',
    updated: `עודכן לאחרונה: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. השירות',
        paragraphs: [
          'תַּרְאוּ היא פלטפורמת השתתפות אזרחית המאפשרת לתושבים מאומתים של רשויות מקומיות בישראל להצביע בנושאים מקומיים. ההצבעות מתועדות עם אימות בלוקצ׳יין ואימות מיקום GPS. הצבעה שהסתיימה עשויה להנפיק BAG, מטבע ב-bags.fm (memecoin) הנטבע על גבי בלוקצ׳יין ציבורי עבור אותה הצבעה, שגורמים חיצוניים יכולים להשקיע בו כדי לממן את ביצוע ההחלטה הזוכה.',
        ],
      },
      {
        heading: '2. זכאות ואימות',
        paragraphs: [
          'ההשתתפות מותנית בהשלמת אימות זהות (הגעה לציון הזהות הנדרש) ובמקרים הרלוונטיים גם אימות מיקום GPS המאשר מגורים ברשות הרלוונטית. נדרש גיל 18 ומעלה.',
        ],
      },
      {
        heading: '3. תשלומים ועמלות',
        paragraphs: [
          'ההשתתפות בהצבעות אינה כרוכה בתשלום. יצירת הצבעה חדשה עולה ₪50, במחיר הנקוב בשקלים חדשים (₪) ומעובד על ידי Green Invoice, המשמשת כסוחר הרשום (Merchant of Record) עבור הרכישה. מסים רלוונטיים מחושבים ונגבים על ידי Green Invoice בעת התשלום.',
          'הקרן הקהילתית של כל הצבעה ממומנת מהשקעות חיצוניות ב-BAG של ההצבעה ב-bags.fm, לא מכספי תושבים. תנועות הקרן מתועדות בשקיפות.',
        ],
      },
      {
        heading: '4. מטבעות ובלוקצ׳יין',
        paragraphs: [
          'BAGS הם מטבעות ב-bags.fm (memecoins) הנטבעים על גבי בלוקצ׳יין ציבורי, BAG אחד לכל הצבעה; כל NFT הנצחה הוא אף הוא פריט on-chain הקשור להשתתפות אזרחית. BAG הוא נכס קריפטו ספקולטיבי ותנודתי המונפק באמצעות פלטפורמת הצד-השלישי bags.fm, אינו מוצר השקעה של תַּרְאוּ, ואינו נושא הבטחה לתשואה כספית; תַּרְאוּ אינה מתחייבת לערך, לנזילות או לתוצאה כלשהם. רישומים על גבי הבלוקצ׳יין הם ציבוריים ובלתי ניתנים לשינוי; אין להגיש תוכן שאינכם מעוניינים לפרסם.',
        ],
      },
      {
        heading: '5. שימוש מותר',
        bullets: [
          'אין להצביע יותר מפעם אחת בכל הצבעה או לעקוף את מנגנון האימות.',
          'אין להגיש תוכן לא חוקי, מטעה או הונאתי.',
          'אין לשבש, לבחון או לפגוע בפלטפורמה או באבטחתה.',
        ],
      },
      {
        heading: '6. הגבלת אחריות',
        paragraphs: [
          'השירות מסופק "כפי שהוא" (AS IS) במהלך הפיילוט. במידה המרבית המותרת בחוק, תַּרְאוּ אינה אחראית לנזקים עקיפים או תוצאתיים הנובעים מהשימוש בשירות.',
        ],
      },
      {
        heading: '7. שינויים וחוק חל',
        paragraphs: [
          'אנו עשויים לעדכן תנאים אלה; שינויים מהותיים ישתקפו בתאריך העדכון. על תנאים אלה חלים דיני מדינת ישראל.',
        ],
      },
      {
        heading: '8. יצירת קשר',
        paragraphs: ['שאלות בנוגע לתנאים: support@taruu.co.il'],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    disclaimer:
      'This English translation is provided for convenience only; the Hebrew original is the binding version.',
    intro:
      'These Terms apply to the use of the Taruu platform ("Taruu", "we"). Use of the service constitutes acceptance of these Terms.',
    updated: `Last updated: ${LAST_UPDATED}`,
    sections: [
      {
        heading: '1. The Service',
        paragraphs: [
          'Taruu is a civic participation platform that allows verified residents of local authorities in Israel to vote on local matters. Votes are recorded with blockchain verification and GPS location verification. A concluded vote may issue a BAG, a bags.fm coin (memecoin) minted on a public blockchain for that vote, in which external parties may invest in order to fund the execution of the winning decision.',
        ],
      },
      {
        heading: '2. Eligibility and Verification',
        paragraphs: [
          'Participation is conditional on completing identity verification (reaching the required identity score) and, in the relevant cases, GPS location verification confirming residence in the relevant authority. A minimum age of 18 is required.',
        ],
      },
      {
        heading: '3. Payments and Fees',
        paragraphs: [
          'Participation in votes is free of charge. Creating a new vote costs ₪50, priced in New Israeli Shekels (₪) and processed by Green Invoice, which serves as the Merchant of Record for the purchase. Applicable taxes are calculated and collected by Green Invoice at the time of payment.',
          'The community fund of each vote is financed by external investments in the vote’s BAG on bags.fm, not by residents’ money. Fund movements are recorded transparently.',
        ],
      },
      {
        heading: '4. Coins and Blockchain',
        paragraphs: [
          'BAGS are bags.fm coins (memecoins) minted on a public blockchain, one BAG per vote; any commemorative NFT is likewise an on-chain item connected to civic participation. A BAG is a speculative and volatile crypto asset issued through the third-party platform bags.fm, is not an investment product of Taruu, and carries no promise of financial return; Taruu does not commit to any value, liquidity, or outcome whatsoever. Records on the blockchain are public and cannot be altered; do not submit content you do not wish to make public.',
        ],
      },
      {
        heading: '5. Permitted Use',
        bullets: [
          'Do not vote more than once in any vote or circumvent the verification mechanism.',
          'Do not submit unlawful, misleading, or fraudulent content.',
          'Do not disrupt, probe, or harm the platform or its security.',
        ],
      },
      {
        heading: '6. Limitation of Liability',
        paragraphs: [
          'The service is provided "as is" (AS IS) during the pilot. To the maximum extent permitted by law, Taruu is not liable for indirect or consequential damages arising from use of the service.',
        ],
      },
      {
        heading: '7. Changes and Governing Law',
        paragraphs: [
          'We may update these Terms; material changes will be reflected in the update date. These Terms are governed by the laws of the State of Israel.',
        ],
      },
      {
        heading: '8. Contact',
        paragraphs: ['Questions regarding these Terms: support@taruu.co.il'],
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

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = COPY[locale];
  const intro = t.disclaimer ? `${t.disclaimer} ${t.intro}` : t.intro;
  return <LegalPage locale={locale} title={t.title} intro={intro} updated={t.updated} sections={t.sections} />;
}
