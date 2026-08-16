import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Locale } from '@/lib/i18n';
import { CartView } from './components/CartView';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'העגלה | חנות המערכת',
    description: 'סקירת ההזמנה ומעבר לתשלום מאובטח בשקלים.',
  },
  en: {
    title: 'The Cart | The Store',
    description: 'Review the order and continue to secure payment in shekels.',
  },
};

interface CartPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: CartPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function CartPage({ params }: CartPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <CartView locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
