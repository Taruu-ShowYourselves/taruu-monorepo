import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CoinMarket } from './components/CoinMarket';
import type { Locale } from '@/lib/i18n';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'BAGS',
    description:
      'שוק ה-BAGS של תַּרְאוּ: כל הצבעה מקבלת BAG משלה ב-bags.fm, מטבע ממים מבוסס בלוקצ׳יין שאנשים מבחוץ קונים כדי להשקיע בתנועה הכלכלית של ההצבעה ולממן את ביצוע החלטת הרוב. שקוף, מאומת, חתום בבלוקצ׳יין.',
  },
  en: {
    title: 'BAGS',
    description:
      "Taruu's BAGS market: every vote gets its own BAG on bags.fm, a blockchain-based meme coin outsiders buy to back the vote's economic momentum and fund carrying out the majority decision. Transparent, verified, signed on-chain.",
  },
};

interface CoinPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: CoinPageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function CoinPage({ params }: CoinPageProps) {
  const { locale } = await params;

  return (
    <>
      <Header locale={locale} />
      <main>
        <CoinMarket locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
