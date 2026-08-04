import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CoinMarket } from './components/CoinMarket';
import type { Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'BAGS',
  description:
    'שוק ה-BAGS של תַּרְאוּ: כל הצבעה מקבלת BAG משלה ב-bags.fm, מטבע ממים מבוסס בלוקצ׳יין שאנשים מבחוץ קונים כדי להשקיע בתנועה הכלכלית של ההצבעה ולממן את ביצוע החלטת הרוב. שקוף, מאומת, חתום בבלוקצ׳יין.',
};

interface CoinPageProps {
  params: Promise<{ locale: Locale }>;
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
