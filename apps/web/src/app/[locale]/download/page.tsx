import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ComingSoon } from '@/components/ui/ComingSoon';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'הורדת האפליקציה',
  description:
    'הורידו את אפליקציית תַּרְאוּ ל-iOS ו-Android והתחילו להשפיע על הקהילה שלכם.',
};

interface DownloadPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { locale } = await params;

  const t = {
    title: locale === 'en' ? 'App Coming Soon' : 'האפליקציה בקרוב',
    description: locale === 'en'
      ? 'The app will be available for download on App Store and Google Play before the first vote. Meanwhile, join the pilot WhatsApp.'
      : 'האפליקציה תהיה זמינה להורדה ב-App Store ו-Google Play לפני ההצבעה הראשונה. בינתיים, הצטרפו לוואטסאפ הפיילוט.',
  };

  return (
    <>
      <Header locale={locale} />
      <main>
        <ComingSoon
          title={t.title}
          description={t.description}
        />
      </main>
      <Footer locale={locale} />
    </>
  );
}
