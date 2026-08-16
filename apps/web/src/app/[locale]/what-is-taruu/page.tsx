import { Metadata } from 'next';
import { Masthead } from '@/components/press';
import {
  WhatIsTaruu,
  CivicReminder,
  CivicMandate,
  Participate,
  Pillars,
  PilotDispatch,
  Colophon,
} from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';

interface WhatIsTaruuMetaCopy {
  title: string;
  description: string;
}

const META: Record<Locale, WhatIsTaruuMetaCopy> = {
  he: {
    title: 'מהי תַּרְאוּ?',
    description:
      'שלוש רשויות מאזנות אחת את השנייה, ותַּרְאוּ מזכירה למי הן עובדות: המנגנון האזרחי מסייע ההחלטה, עמודי התווך שלו, כלי ההשתתפות והפתיחה הארצית ב-04.08.26.',
  },
  en: {
    title: 'What is Taruu?',
    description:
      'Three branches balance one another, and Taruu reminds them who they work for: the civic decision-support mechanism, its pillars, the participation tools, and the national launch on 04.08.26.',
  },
};

interface WhatIsTaruuPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: WhatIsTaruuPageProps): Promise<Metadata> {
  const { locale } = await params;
  return META[locale];
}

/**
 * The case for the mechanism, on its own page.
 *
 * The homepage deliberately opens on what is actually up for a vote, so the
 * argument lives here instead: the three branches and the diagnosis, who the
 * branches work for, and the declaration - the same three beats the investor
 * edition opens with. What follows is the answer to "so what do I do": the
 * pillars, the participation surfaces themselves, and the launch date.
 *
 * The old four-step "how it works" strip is gone. It restated the pillars in
 * weaker words one screen after them, and /how-it-works now redirects here.
 */
export default async function WhatIsTaruuPage({ params }: WhatIsTaruuPageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main>
        <WhatIsTaruu locale={locale} />
        <CivicReminder locale={locale} />
        <CivicMandate locale={locale} />
        <Pillars locale={locale} />
        <Participate locale={locale} />
        <PilotDispatch locale={locale} />
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
