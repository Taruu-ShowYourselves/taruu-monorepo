import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './CivicMandate.module.css';

interface CivicMandateProps {
  locale?: Locale;
}

interface CivicMandateCopy {
  editionLine: string;
  editionEcho: string;
  label: string;
  lead: string;
  strong1: string;
  mid: string;
  strong2: string;
  tail: string;
  strong3: string;
  footnote: string;
  cta: string;
  arrow: string;
}

const COPY: Record<Locale, CivicMandateCopy> = {
  he: {
    editionLine: 'הצו האזרחי · מנגנון מסייע החלטה',
    editionEcho: 'THE CIVIC MANDATE / DECISION SUPPORT',
    label: 'הצהרה',
    lead: 'ועל כן, כ',
    strong1: 'מנגנון שיעזור לכנסת ולרשויות להחליט',
    mid: ', ניצוק את קולנו לגיבוש',
    strong2: 'ריבון אזרחי',
    tail: '. את רצונו אנו מצפים מן הממשלה והרשויות',
    strong3: 'לבצע ללא כל הסתייגות.',
    footnote: 'לא המלצה. לא משאל. עמדה אזרחית מאומתת שאי אפשר להסיט הצדה.',
    cta: 'אני אזרח ורוצה להשתתף',
    arrow: '←',
  },
  en: {
    editionLine: 'The civic mandate · decision support',
    editionEcho: 'הצו האזרחי / מנגנון מסייע החלטה',
    label: 'Declaration',
    lead: 'And so, as ',
    strong1: 'a mechanism that helps the Knesset and the authorities decide',
    mid: ', we pour our voice into forming a',
    strong2: 'civic sovereign',
    tail: '. Its will we expect the government and the authorities',
    strong3: 'to carry out without reservation.',
    footnote: 'Not a recommendation. Not a poll. A verified civic position that cannot be pushed aside.',
    cta: 'I am a citizen and I want to take part',
    arrow: '→',
  },
};

/**
 * The mandate itself, lifted out of the explainer that precedes it. The claim
 * that a civic sovereign's will is binding is the load-bearing sentence of the
 * whole argument, so it gets its own editorial beat rather than a paragraph
 * column beside the mechanism list.
 */
export function CivicMandate({ locale = 'he' }: CivicMandateProps) {
  const t = COPY[locale];
  return (
    <section
      id="civic-mandate"
      className={styles.section}
      aria-labelledby="civic-mandate-statement"
    >
      <div className={styles.inner}>
        <div className={styles.editionLine}>
          <span>{t.editionLine}</span>
          <span aria-hidden>{t.editionEcho}</span>
        </div>

        <p className={styles.label}>{t.label}</p>

        <blockquote id="civic-mandate-statement" className={styles.statement}>
          {t.lead}<strong>{t.strong1}</strong>{t.mid}{' '}
          <strong>{t.strong2}</strong>{t.tail}{' '}
          <strong className={styles.binding}>{t.strong3}</strong>
        </blockquote>

        <div className={styles.foot}>
          <p className={styles.footnote}>{t.footnote}</p>
          <Link href={`${localePrefix(locale)}/sign-up`} className={styles.cta}>
            {t.cta} <span aria-hidden>{t.arrow}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
