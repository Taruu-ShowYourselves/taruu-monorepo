import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Locale } from '@/lib/i18n';
import { DownloadHero, AppFeatures } from './components';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'תַּרְאוּ בכיס שלכם — בקרוב',
  description:
    'האפליקציה של תַּרְאוּ תהיה זמינה ב-App Store וב-Google Play לקראת ההצבעה הראשונה. הצטרפו לקבוצת המייסדים ותהיו הראשונים לדעת כשהיא יוצאת.',
};

interface DownloadPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main className={styles.main}>
        <DownloadHero />
        <AppFeatures />
      </main>
      <Footer locale={locale} />
    </>
  );
}
