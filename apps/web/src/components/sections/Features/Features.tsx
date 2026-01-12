'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Typography';
import type { Locale } from '@/lib/i18n';
import styles from './Features.module.css';

interface FeaturesProps {
  locale?: Locale;
}

const getFeatures = (locale: Locale) => [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
    title: locale === 'en' ? 'Real Local Issues' : 'נושאים מקומיים מהשטח',
    description: locale === 'en'
      ? 'What concerns the street and neighborhood. You decide what goes to vote and propose topics for consensus.'
      : 'מה שמעסיק את הרחוב והשכונה. אתם קובעים מה יעלה להצבעה ומציעים נושאים לקונצנזוס.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: locale === 'en' ? 'Verified Residents Only' : 'תושבים מאומתים בלבד',
    description: locale === 'en'
      ? 'Only those who live within the municipality participate and influence. GPS verification ensures the voice is local and authentic.'
      : 'רק מי שגר בתוך הרשות משתתף ומשפיע. אימות GPS מוודא שהקול הוא מקומי ואותנטי.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M2 12h4M18 12h4" />
      </svg>
    ),
    title: locale === 'en' ? 'Transparent Results for Everyone' : 'תוצאות שקופות לכולם',
    description: locale === 'en'
      ? 'See the full picture in real time. No "closed rooms" - data is visible to residents and council alike.'
      : 'רואים את התמונה המלאה בזמן אמת. בלי "חדרים סגורים", הנתונים גלויים לתושבים ולמועצה כאחד.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8M8 13h4" />
      </svg>
    ),
    title: locale === 'en' ? 'Focused Community Dialogue' : 'שיח קהילתי ענייני',
    description: locale === 'en'
      ? 'Reducing noise and verbal hostility in favor of an organized tool that creates clarity and consensus.'
      : 'מורידים את מפלס הרעש והאלימות המילולית לטובת כלי מסודר שיוצר בהירות והסכמות.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: locale === 'en' ? 'Full Financial Transparency' : 'שקיפות כספית מלאה',
    description: locale === 'en'
      ? 'The participation fee (₪3) is clearly divided: ₪2 goes to a community trust fund for experts and public interest advancement, ₪1 goes to platform maintenance and development.'
      : 'דמי ההשתתפות (₪3) מתחלקים בצורה ברורה: ₪2 נשמרים בקרן נאמנות קהילתית לטובת מומחים וקידום האינטרס הציבורי, ו-₪1 משמש לתחזוקה ופיתוח הפלטפורמה.',
  },
];

export function Features({ locale = 'he' }: FeaturesProps) {
  const features = getFeatures(locale);
  const sectionTitle = locale === 'en' ? 'Why Does This Exist?' : 'למה זה קיים?';

  return (
    <section className={styles.features} aria-label={sectionTitle}>
      {/* Section Header */}
      <div className={styles.header}>
        <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
      </div>
      <div className={styles.marquee}>
        <div className={styles.track}>
          {features.map((feature, index) => (
            <Card
              key={`${feature.title}-${index}`}
              variant="elevated"
              padding="lg"
              className={styles.card}
            >
              <CardContent>
                <div
                  role="article"
                  aria-label={feature.title}
                  className={styles.cardInner}
                >
                  <div className={styles.iconWrapper}>{feature.icon}</div>
                  <h3 className={styles.cardTitle}>{feature.title}</h3>
                  <Text size="base" color="secondary">
                    {feature.description}
                  </Text>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
