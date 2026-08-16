'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { municipalityHref } from '@/components/uikit/municipality-link';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { localePrefix } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import styles from './ThesisChapters.module.css';

/**
 * A chapter's way into the product - each claim ends with the door to the
 * part of the site that makes it true.
 *
 * Location-aware where a location makes the door more specific: a reader who
 * has told the paper their town is sent to that town's desk or score sheet,
 * anyone else to the country-wide page. The server renders the anonymous
 * door; the stored town (device-local, never sent anywhere) swaps it in
 * after mount and follows the locality desk live.
 */

export type ChapterCtaKind = 'desk' | 'vote' | 'score' | 'mandate';

interface CtaCopy {
  desk: (town: string | null) => string;
  vote: string;
  score: (town: string | null) => string;
  mandate: string;
  glyph: string;
}

const COPY: Record<Locale, CtaCopy> = {
  he: {
    desk: (town) => (town ? `לדסק של ${town}` : 'לקרוא את כל הארץ'),
    vote: 'להצביע עכשיו',
    score: (town) => (town ? `הציון של ${town}` : 'ציון הממשלה'),
    mandate: 'למנדט האזרחי',
    glyph: '←',
  },
  en: {
    desk: (town) => (town ? `To the ${town} desk` : 'Read the whole country'),
    vote: 'Vote now',
    score: (town) => (town ? `${town}'s score` : "The government's score"),
    mandate: 'To the civic mandate',
    glyph: '→',
  },
};

export function ChapterCta({
  kind,
  locale = 'he',
}: {
  kind: ChapterCtaKind;
  locale?: Locale;
}) {
  const t = COPY[locale];
  const [town, setTown] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setTown(getStoredMunicipality());
    read();
    window.addEventListener(LOCALITY_EVENT, read);
    return () => window.removeEventListener(LOCALITY_EVENT, read);
  }, []);

  const prefix = localePrefix(locale);
  let href: string;
  let label: string;
  switch (kind) {
    case 'desk':
      href = town ? municipalityHref(town, locale) : `${prefix}/explore`;
      label = t.desk(town);
      break;
    case 'vote':
      href = `${prefix}/feed`;
      label = t.vote;
      break;
    case 'score':
      href = town ? municipalityHref(town, locale) : `${prefix}/knesset`;
      label = t.score(town);
      break;
    case 'mandate':
      href = `${prefix}/mandate`;
      label = t.mandate;
      break;
  }

  return (
    <Link className={styles.cta} href={href}>
      {label} <span aria-hidden>{t.glyph}</span>
    </Link>
  );
}
