import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PricingContent } from './components/PricingContent';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'תמחור | תַּרְאוּ',
  description:
    'פשוט, שקוף, בלי הפתעות. ההצבעה חינם; ₪50 ליצירת הצבעה חדשה. אין מנוי, אין דמי חבר, אין אותיות קטנות.',
};

interface PricingPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <PricingContent />
      <Footer locale={locale} />
    </>
  );
}
