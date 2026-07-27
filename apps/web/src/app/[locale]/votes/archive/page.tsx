import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArchiveHero } from './components/ArchiveHero';
import { ArchiveList } from './components/ArchiveList';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'קיר הניצחון | ארכיון הצבעות',
  description:
    'ארכיון ההצבעות שהסתיימו — תוצאות, תעודות השתתפות ורשומות חתומות.',
};

interface ArchivePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <ArchiveHero />
        <ArchiveList />
      </main>
      <Footer locale={locale} />
    </>
  );
}
