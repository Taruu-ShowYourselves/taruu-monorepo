import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isCouncilPublicPagesEnabled } from '@/lib/features/council-public-pages';
import type { Locale } from '@/lib/i18n';
import { CouncilPublicPage } from './CouncilPublicPage';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'פרופיל מועצה ציבורי | תַּרְאוּ',
    description:
      'אוכלוסייה רשמית, קהילת תַּרְאוּ, מנהלים, משתמשים משלמים והצבעות - עם מקורות וזמני עדכון.',
  },
  en: {
    title: 'Public council profile | Taruu',
    description:
      'Official population, the Taruu community, managers, paying users and votes - with sources and update times.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; identifier: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function CouncilPage({
  params,
}: {
  params: Promise<{ locale: string; identifier: string }>;
}) {
  if (!isCouncilPublicPagesEnabled()) notFound();
  const { locale, identifier } = await params;
  return <CouncilPublicPage locale={locale} identifier={identifier} />;
}
