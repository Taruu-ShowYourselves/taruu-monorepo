import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FAQHero, FAQList } from './components';
import { faqData, faqDataEn } from './data/faqData';
import type { Locale } from '@/lib/i18n';

interface FAQMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, FAQMetaCopy> = {
  he: {
    title: 'שאלות נפוצות',
    description:
      'תשובות לשאלות נפוצות על תַּרְאוּ - פלטפורמה להצבעות מקומיות שקופות.',
  },
  en: {
    title: 'FAQ',
    description:
      'Answers to frequently asked questions about Taruu - a platform for transparent local votes.',
  },
};

interface FAQPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

function FAQJsonLd({ locale }: { locale: Locale }) {
  const items = locale === 'en' ? faqDataEn : faqData;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
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

export default async function FAQPage({ params }: FAQPageProps) {
  const { locale } = await params;

  return (
    <>
      <FAQJsonLd locale={locale} />
      <Header locale={locale} />
      <main>
        <FAQHero locale={locale} />
        <FAQList locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
