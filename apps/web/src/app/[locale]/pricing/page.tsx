import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PricingContent } from './components/PricingContent';
import type { Locale } from '@/lib/i18n';

interface PricingMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, PricingMetaCopy> = {
  he: {
    title: 'תמחור | תַּרְאוּ',
    description:
      'פשוט, שקוף, בלי הפתעות. ההצבעה חינם; ₪50 ליצירת הצבעה חדשה. אין מנוי, אין דמי חבר, אין אותיות קטנות.',
  },
  en: {
    title: 'Pricing | Taruu',
    description:
      'Simple, transparent, no surprises. Voting is free; ₪50 (ILS) to create a new vote. No subscription, no membership fees, no fine print.',
  },
};

interface PricingPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: PricingPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <PricingContent locale={locale} />
      <Footer locale={locale} />
    </>
  );
}
