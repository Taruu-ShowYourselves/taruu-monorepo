import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Locale } from '@/lib/i18n';
import { DownloadHero, AppFeatures } from './components';
import styles from './page.module.css';

const META: Record<Locale, Metadata> = {
  he: {
    title: 'תַּרְאוּ בכיס שלכם - בקרוב',
    description:
      'האפליקציה של תַּרְאוּ תהיה זמינה ב-App Store וב-Google Play לקראת ההצבעה הראשונה. הצטרפו לקבוצת המייסדים ותהיו הראשונים לדעת כשהיא יוצאת.',
  },
  en: {
    title: 'Taruu in your pocket — coming soon',
    description:
      'The Taruu app will be available on the App Store and Google Play ahead of the first vote. Join the founders’ group and be the first to know when it ships.',
  },
};

interface DownloadPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: DownloadPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main className={styles.main}>
        <DownloadHero locale={locale} />
        <AppFeatures locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
