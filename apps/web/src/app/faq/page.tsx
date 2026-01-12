import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FAQHero, FAQList } from './components';
import { faqData } from './data/faqData';

export const metadata: Metadata = {
  title: 'שאלות נפוצות',
  description:
    'תשובות לשאלות נפוצות על תֵּרָאוּ - פלטפורמה להצבעות מקומיות שקופות.',
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

export default function FAQPage() {
  return (
    <>
      <FAQJsonLd />
      <Header />
      <main>
        <FAQHero />
        <FAQList />
      </main>
      <Footer />
    </>
  );
}
