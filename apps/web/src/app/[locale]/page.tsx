import { Countdown, Masthead, Ticker } from '@/components/press';
import {
  Lead,
  BackedBy,
  KnessetDesk,
  ConsensusDesk,
  ActNow,
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

// Re-render at most every 5 minutes so the desks stay fresh without
// hitting Supabase on every request.
export const revalidate = 300;

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <Ticker />
      <Countdown />
      <main>
        <Lead locale={locale} />
        <BackedBy />
        <ConsensusDesk locale={locale} />
        <KnessetDesk locale={locale} />
        <ActNow locale={locale} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
