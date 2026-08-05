import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Locale } from '@/lib/i18n';
import { ThankYouView } from './components/ThankYouView';

// Cast Suspense for React 19 type compatibility (matches settings/social-connections).
const SuspenseWrapper = Suspense as unknown as (props: {
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}) => React.JSX.Element;

export const metadata: Metadata = {
  title: 'ההזמנה התקבלה | חנות המערכת',
  description: 'אישור הזמנה: שילוח תוך 7–14 ימי עסקים וחשבונית מס במייל.',
};

interface ThankYouPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function ThankYouPage({ params }: ThankYouPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <SuspenseWrapper fallback={null}>
          <ThankYouView locale={locale} />
        </SuspenseWrapper>
      </main>
      <Footer locale={locale} />
    </>
  );
}
