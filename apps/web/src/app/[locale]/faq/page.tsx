import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FAQHero, FAQList } from './components';
import { faqData } from './data/faqData';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'שאלות נפוצות',
  description:
    'תשובות לשאלות נפוצות על תַּרְאוּ - פלטפורמה להצבעות מקומיות שקופות.',
};

function FAQJsonLd() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}

interface FAQPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function FAQPage({ params }: FAQPageProps) {
  const { locale } = await params;

  return (
    <>
      <FAQJsonLd />
      <Header locale={locale} />
      <main>
        <FAQHero />
        <FAQList />
      </main>
      <Footer locale={locale} />
    </>
  );
}
