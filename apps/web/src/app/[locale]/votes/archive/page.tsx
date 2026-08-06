import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArchiveHero } from './components/ArchiveHero';
import { ArchiveList } from './components/ArchiveList';
import type { Locale } from '@/lib/i18n';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'קיר הניצחון | ארכיון הצבעות',
    description:
      'ארכיון ההצבעות שהסתיימו - צפו בתוצאות, NFTs שהונפקו ובהשפעת התומכים החיצוניים.',
  },
  en: {
    title: 'Victory Wall | Vote Archive',
    description:
      'The archive of concluded votes - see the results, the NFTs minted, and the impact of outside supporters.',
  },
};

interface ArchivePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: ArchivePageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <ArchiveHero locale={locale} />
        <ArchiveList locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
