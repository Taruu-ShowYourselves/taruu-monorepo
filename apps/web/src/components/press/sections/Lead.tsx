'use client';

import Image from 'next/image';
import { NewsButton } from '@/components/press/NewsButton';
import { LiveVoteWidget } from '@/components/press/VoteWidget';
import type { Locale } from '@/lib/i18n';
import styles from './Lead.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { localePrefix } from '@/lib/i18n';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface LeadProps {
  locale?: Locale;
}

interface LeadCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
  figAlt: string;
  figCaption: string;
  bylineAuthor: string;
  bylineRegion: string;
  bylineDate: string;
  foundersCta: string;
  whatIsTaruuLink: string;
  briefHead: string;
  briefs: { k: string; t: string }[];
  priceKicker: string;
  priceValue: string;
  priceMeta: string;
  briefMore: string;
  arrow: string;
}

const COPY: Record<Locale, LeadCopy> = {
  he: {
    kicker: 'הסיפור הראשי · עמוד 1',
    headline: 'הקול של האנשים, האזרחים, עכשיו',
    headlineRed: 'במספרים.',
    standfirst:
      'תַּרְאוּ מודדת את עמדת רוב התושבים בנושאים המקומיים: כל קול מאומת, הספירה גלויה. תמונת מצב אחת שהמועצה לא יכולה להתעלם ממנה. כאן לא רק קוראים את העיתון. מצביעים בתוכו.',
    figAlt: 'תושבים מרימים את קולם ואת פתקי ההצבעה, איור קונצנזוס ציבורי',
    figCaption: 'איור: המערכת · «הקול של הרבים נמדד»',
    bylineAuthor: 'מאת המערכת',
    bylineRegion: 'כל הארץ',
    bylineDate: '04.08.26',
    foundersCta: 'קבוצת המייסדים',
    whatIsTaruuLink: 'מהי תַּרְאוּ? ←',
    briefHead: 'עוד בגיליון',
    briefs: [
      { k: 'מודדים', t: 'כמה באמת תומכים, כמה מתנגדים: מספר מדויק, לא תחושת בטן.' },
      { k: 'מאמתים', t: 'כל קול הוא תושב אמיתי אחד. זהות ו-GPS, חתום בבלוקצ׳יין.' },
      { k: 'מנגישים', t: 'התמונה המלאה פתוחה לכולם. שקיפות מלאה, בלי חדרים סגורים.' },
    ],
    priceKicker: 'השתתפות',
    priceValue: 'חינם',
    priceMeta: 'בלי תשלום · זהות מאומתת · תוצאות שקופות',
    briefMore: 'לכל הכלים ←',
    arrow: '←',
  },
  en: {
    kicker: 'Lead story · Page 1',
    headline: 'The voice of the people, the citizens, now',
    headlineRed: 'in numbers.',
    standfirst:
      'Taruu measures where most residents stand on local issues: every vote verified, the count in the open. One picture the council cannot ignore. Here you do not just read the paper. You vote inside it.',
    figAlt: 'Residents raising their voices and their ballots, an illustration of public consensus',
    figCaption: 'Illustration: the Editors · «The voice of the many, measured»',
    bylineAuthor: 'By the Editors',
    bylineRegion: 'Nationwide',
    bylineDate: '04.08.26',
    foundersCta: 'The founders’ group',
    whatIsTaruuLink: 'What is Taruu? →',
    briefHead: 'Also in this issue',
    briefs: [
      { k: 'We measure', t: 'How many truly support, how many oppose: an exact number, not a gut feeling.' },
      { k: 'We verify', t: 'Every vote is one real resident. Identity and GPS, signed on the blockchain.' },
      { k: 'We make it public', t: 'The full picture is open to everyone. Full transparency, no closed rooms.' },
    ],
    priceKicker: 'Participation',
    priceValue: 'Free',
    priceMeta: 'No fee · Verified identity · Transparent results',
    briefMore: 'All the tools →',
    arrow: '→',
  },
};

export function Lead({ locale = 'he' }: LeadProps) {
  const t = COPY[locale];
  return (
    <section className={styles.lead}>
      <div className={styles.grid}>
        {/* Live ballot - participation control surface */}
        <aside className={styles.colBallot}>
          <LiveVoteWidget issueNo="04" locale={locale} />
        </aside>

        {/* Lead story */}
        <div className={styles.colStory}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>

          <h1 className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h1>

          <p className={styles.standfirst}>
            {t.standfirst}
          </p>

          <figure className={styles.figure}>
            <Image
              src="/images/civic-engraving.png"
              alt={t.figAlt}
              width={1400}
              height={930}
              className={styles.figImg}
              priority
            />
            <figcaption className={styles.figCap}>
              <span aria-hidden className={styles.figTick} />
              {t.figCaption}
            </figcaption>
          </figure>

          <div className={styles.byline}>
            <span>{t.bylineAuthor}</span>
            <span className={styles.sep} aria-hidden>■</span>
            <span>{t.bylineRegion}</span>
            <span className={styles.sep} aria-hidden>■</span>
            <span>{t.bylineDate}</span>
          </div>

          <div className={styles.actions}>
            <NewsButton href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" variant="red" size="lg" trailing={<span aria-hidden>{t.arrow}</span>}>
              {t.foundersCta}
            </NewsButton>
            <a href={`${localePrefix(locale)}/what-is-taruu`} className={styles.textLink}>{t.whatIsTaruuLink}</a>
          </div>
        </div>

        {/* Side briefs - "also in this issue" */}
        <aside className={styles.colBriefs}>
          <span className={styles.briefHead}>{t.briefHead}</span>
          <ul className={styles.briefs}>
            {t.briefs.map((b, i) => (
              <li key={i} className={styles.brief}>
                <span className={styles.briefNum}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className={styles.briefKicker}>{b.k}</span>
                  <p className={styles.briefText}>{b.t}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.priceBox}>
            <span className={styles.priceK}>{t.priceKicker}</span>
            <span className={styles.priceNum}>{t.priceValue}</span>
            <span className={styles.priceMeta}>{t.priceMeta}</span>
          </div>

          <a href={`${localePrefix(locale)}/what-is-taruu`} className={styles.briefMore}>{t.briefMore}</a>
        </aside>
      </div>

    </section>
  );
}
