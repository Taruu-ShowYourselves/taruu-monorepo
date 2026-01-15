import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import type { Locale } from '@/lib/i18n';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'הורדת האפליקציה',
  description:
    'הורידו את אפליקציית תַּרְאוּ ל-iOS ו-Android והתחילו להשפיע על הקהילה שלכם.',
};

interface DownloadPageProps {
  params: Promise<{ locale: Locale }>;
}

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { locale } = await params;

  const t = {
    hero: {
      title: locale === 'en' ? 'Download the App' : 'הורדת האפליקציה',
      subtitle: locale === 'en'
        ? 'Join the Kiryat Tivon pilot and be among the first to vote on local issues'
        : 'הצטרפו לפיילוט קריית טבעון והיו מהראשונים להצביע על נושאים מקומיים',
    },
    stores: {
      title: locale === 'en' ? 'Available Soon' : 'בקרוב בחנויות',
      appStore: locale === 'en' ? 'App Store' : 'App Store',
      playStore: locale === 'en' ? 'Google Play' : 'Google Play',
      comingSoon: locale === 'en' ? 'Coming Soon' : 'בקרוב',
    },
    pilot: {
      title: locale === 'en' ? 'Join the Pilot' : 'הצטרפו לפיילוט',
      description: locale === 'en'
        ? 'Be the first to know when the app launches. Join our WhatsApp group for updates and early access.'
        : 'היו הראשונים לדעת כשהאפליקציה תושק. הצטרפו לקבוצת הוואטסאפ שלנו לעדכונים וגישה מוקדמת.',
      cta: locale === 'en' ? 'Join WhatsApp Group' : 'הצטרפו לוואטסאפ',
    },
    features: {
      title: locale === 'en' ? 'App Features' : 'מה באפליקציה',
      list: [
        {
          icon: '🗳️',
          title: locale === 'en' ? 'Local Voting' : 'הצבעות מקומיות',
          description: locale === 'en'
            ? 'Vote on issues that matter to your community'
            : 'הצביעו על נושאים שחשובים לקהילה שלכם',
        },
        {
          icon: '📍',
          title: locale === 'en' ? 'GPS Verification' : 'אימות GPS',
          description: locale === 'en'
            ? 'Secure location verification ensures local residents only'
            : 'אימות מיקום מאובטח מבטיח השתתפות תושבים מקומיים בלבד',
        },
        {
          icon: '🔗',
          title: locale === 'en' ? 'Blockchain Security' : 'אבטחת בלוקצ\'יין',
          description: locale === 'en'
            ? 'Every vote is recorded on the blockchain for transparency'
            : 'כל הצבעה נרשמת על הבלוקצ\'יין לשקיפות מלאה',
        },
        {
          icon: '🎫',
          title: locale === 'en' ? 'Earn Tokens' : 'צברו טוקנים',
          description: locale === 'en'
            ? 'Get SYNC tokens for participating in votes'
            : 'קבלו טוקני SYNC עבור השתתפות בהצבעות',
        },
      ],
    },
    requirements: {
      title: locale === 'en' ? 'Requirements' : 'דרישות מערכת',
      ios: locale === 'en' ? 'iOS 15.0 or later' : 'iOS 15.0 ומעלה',
      android: locale === 'en' ? 'Android 10 or later' : 'אנדרואיד 10 ומעלה',
    },
  };

  return (
    <>
      <Header locale={locale} />
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <Heading level={1} align="center">
              {t.hero.title}
            </Heading>
            <Text size="xl" color="secondary" align="center" className={styles.subtitle}>
              {t.hero.subtitle}
            </Text>
          </div>
        </section>

        {/* Store Buttons */}
        <section className={styles.stores}>
          <div className={styles.container}>
            <Heading level={2} align="center">
              {t.stores.title}
            </Heading>
            <div className={styles.storeButtons}>
              <div className={styles.storeButton}>
                <div className={styles.storeBadge}>
                  <svg viewBox="0 0 24 24" className={styles.storeIcon}>
                    <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className={styles.storeInfo}>
                    <span className={styles.storeLabel}>{t.stores.comingSoon}</span>
                    <span className={styles.storeName}>{t.stores.appStore}</span>
                  </div>
                </div>
              </div>
              <div className={styles.storeButton}>
                <div className={styles.storeBadge}>
                  <svg viewBox="0 0 24 24" className={styles.storeIcon}>
                    <path fill="currentColor" d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.54.68.54 1.19 0 .51-.2.92-.54 1.19l-2.49 1.44-2.47-2.47 2.47-2.47 2.49 1.12M6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
                  </svg>
                  <div className={styles.storeInfo}>
                    <span className={styles.storeLabel}>{t.stores.comingSoon}</span>
                    <span className={styles.storeName}>{t.stores.playStore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <div className={styles.container}>
            <Heading level={2} align="center" className={styles.featuresTitle}>
              {t.features.title}
            </Heading>
            <div className={styles.featureGrid}>
              {t.features.list.map((feature, index) => (
                <div key={index} className={styles.featureCard}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <Heading level={4}>
                    {feature.title}
                  </Heading>
                  <Text color="secondary" size="sm">
                    {feature.description}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pilot CTA Section */}
        <section className={styles.pilot}>
          <div className={styles.container}>
            <div className={styles.pilotCard}>
              <Heading level={2}>
                {t.pilot.title}
              </Heading>
              <Text color="secondary" size="lg" className={styles.pilotDescription}>
                {t.pilot.description}
              </Text>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="lg">
                  {t.pilot.cta}
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className={styles.requirements}>
          <div className={styles.container}>
            <Heading level={3} align="center">
              {t.requirements.title}
            </Heading>
            <div className={styles.requirementsList}>
              <div className={styles.requirement}>
                <svg viewBox="0 0 24 24" className={styles.osIcon}>
                  <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <Text color="secondary">{t.requirements.ios}</Text>
              </div>
              <div className={styles.requirement}>
                <svg viewBox="0 0 24 24" className={styles.osIcon}>
                  <path fill="currentColor" d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.54.68.54 1.19 0 .51-.2.92-.54 1.19l-2.49 1.44-2.47-2.47 2.47-2.47 2.49 1.12M6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
                </svg>
                <Text color="secondary">{t.requirements.android}</Text>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}
