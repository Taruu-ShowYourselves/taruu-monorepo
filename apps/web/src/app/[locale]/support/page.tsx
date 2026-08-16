import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SupportHero } from './components/SupportHero';
import { SupportFlow } from './components/SupportFlow';
import type { Locale } from '@/lib/i18n';

const META: Record<Locale, Metadata> = {
  he: {
    title: 'תמיכה | תַּרְאוּ',
    description:
      'יש שאלה? יש תשובה. כל מה שרציתם לדעת על הצבעה, אימות, כסף ופרטיות, במקום אחד. לא מצאתם? כתבו לנו בוואטסאפ.',
  },
  en: {
    title: 'Support | Taruu',
    description:
      'Have a question? There is an answer. Everything you wanted to know about voting, verification, money and privacy, in one place. Did not find it? Write to us on WhatsApp.',
  },
};

interface SupportPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: SupportPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

export default async function SupportPage({ params }: SupportPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <SupportHero locale={locale} />
        <SupportFlow locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
