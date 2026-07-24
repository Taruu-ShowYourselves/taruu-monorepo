import { Masthead, Ticker } from '@/components/press';
import {
  Lead,
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
      <main>
        <Lead locale={locale} />
        <ConsensusDesk locale={locale} />
        <KnessetDesk locale={locale} />
        <ActNow locale={locale} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
