import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isCouncilPublicPagesEnabled } from '@/lib/features/council-public-pages';
import { CouncilPublicPage } from './CouncilPublicPage';

export const metadata: Metadata = {
  title: 'פרופיל מועצה ציבורי | תַּרְאוּ',
  description:
    'אוכלוסייה רשמית, קהילת תַּרְאוּ, מנהלים, משתמשים משלמים והצבעות — עם מקורות וזמני עדכון.',
};

export default async function CouncilPage({
  params,
}: {
  params: Promise<{ locale: string; identifier: string }>;
}) {
  if (!isCouncilPublicPagesEnabled()) notFound();
  const { locale, identifier } = await params;
  return <CouncilPublicPage locale={locale} identifier={identifier} />;
}
