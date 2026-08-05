import { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'תנאי שימוש | תַּרְאוּ',
  description: 'תנאי השימוש בפלטפורמת תַּרְאוּ, הצבעות אזרחיות לרשויות מקומיות בישראל.',
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

const LAST_UPDATED = '2026-07-29';

function content(locale: Locale): { title: string; intro: string; updated: string; sections: LegalSection[] } {
  if (locale === 'en') {
    return {
      title: 'Terms of Service',
      intro:
        'These Terms govern your use of the Taro civic-consensus platform ("Taro", "we", "us"). By using the service you agree to these Terms.',
      updated: `Last updated: ${LAST_UPDATED}`,
      sections: [
        {
          heading: '1. The Service',
          paragraphs: [
            'Taro is a civic participation platform that lets verified residents of Israeli municipalities vote on local affairs. Votes are recorded with blockchain verification and GPS pinning. Each resolved vote may issue a BAG: a bags.fm memecoin minted on a public blockchain for that vote, which outsiders may invest in to fund execution of the winning decision.',
          ],
        },
        {
          heading: '2. Eligibility & Verification',
          paragraphs: [
            'To participate you must complete identity verification (reaching the required identity score) and, where applicable, GPS location verification confirming residency in the relevant municipality. You must be at least 18 years old.',
          ],
        },
        {
          heading: '3. Payments & Fees',
          paragraphs: [
            'Participating in a vote is free of charge. Creating a new vote costs ₪50, priced in Israeli New Shekels (ILS) and processed by Green Invoice, which acts as the Merchant of Record for your purchase. Applicable taxes are calculated and collected by Green Invoice at checkout.',
            'A vote’s community fund is financed through outside investment in the vote’s BAG on bags.fm, not through resident payments. Fund movements are recorded transparently.',
          ],
        },
        {
          heading: '4. Tokens & Blockchain',
          paragraphs: [
            'BAGS are bags.fm memecoins minted on a public blockchain, one BAG per vote; any commemorative NFTs are likewise on-chain artifacts tied to civic participation. A BAG is a volatile, speculative crypto-asset issued via the third-party bags.fm platform, not a Taro investment product, and carries no promise of financial return; Taro does not guarantee any value, liquidity, or outcome. On-chain records are public and immutable; do not submit content you are not willing to make public.',
          ],
        },
        {
          heading: '5. Acceptable Use',
          bullets: [
            'Do not attempt to vote more than once per vote or to circumvent verification.',
            'Do not submit unlawful, fraudulent, or misleading content.',
            'Do not interfere with, probe, or disrupt the platform or its security.',
          ],
        },
        {
          heading: '6. Limitation of Liability',
          paragraphs: [
            'The service is provided “as is” during the pilot. To the maximum extent permitted by law, Taro is not liable for indirect or consequential damages arising from use of the service.',
          ],
        },
        {
          heading: '7. Changes & Governing Law',
          paragraphs: [
            'We may update these Terms; material changes will be reflected by the “last updated” date. These Terms are governed by the laws of the State of Israel.',
          ],
        },
        {
          heading: '8. Contact',
          paragraphs: ['Questions about these Terms: support@taruu.co.il'],
        },
      ],
    };
  }

  return {
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
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const c = content(locale);
  return <LegalPage locale={locale} title={c.title} intro={c.intro} updated={c.updated} sections={c.sections} />;
}
