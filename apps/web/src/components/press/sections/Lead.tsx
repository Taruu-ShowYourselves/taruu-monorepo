'use client';

import Image from 'next/image';
import { NewsButton } from '@/components/press/NewsButton';
import { LiveVoteWidget } from '@/components/press/VoteWidget';
import type { Locale } from '@/lib/i18n';
import styles from './Lead.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface LeadProps {
  locale?: Locale;
}

const BRIEFS = [
  { k: 'מודדים', t: 'כמה באמת תומכים, כמה מתנגדים: מספר מדויק, לא תחושת בטן.' },
  { k: 'מאמתים', t: 'כל קול הוא תושב אמיתי אחד. זהות ו-GPS, חתום בבלוקצ׳יין.' },
  { k: 'מנגישים', t: 'התמונה המלאה פתוחה לכולם. שקיפות מלאה, בלי חדרים סגורים.' },
];

export function Lead({ locale = 'he' }: LeadProps) {
  return (
    <section className={styles.lead}>
      <div className={styles.grid}>
        {/* Live ballot — participation control surface */}
        <aside className={styles.colBallot}>
          <LiveVoteWidget issueNo="04" />
        </aside>

        {/* Lead story */}
        <div className={styles.colStory}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הסיפור הראשי · עמוד 1
          </span>

          <h1 className={styles.headline}>
            הקול של האנשים, האזרחים, עכשיו <span className={styles.red}>במספרים.</span>
          </h1>

          <p className={styles.standfirst}>
            תַּרְאוּ מודד את עמדת רוב התושבים בנושאים המקומיים: כל קול מאומת,
            הספירה גלויה. תמונת מצב אחת שהמועצה לא יכולה להתעלם ממנה.
            כאן לא רק קוראים את העיתון. מצביעים בתוכו.
          </p>

          <figure className={styles.figure}>
            <Image
              src="/images/civic-engraving.png"
              alt="תושבים מרימים את קולם ואת פתקי ההצבעה, איור קונצנזוס ציבורי"
              width={1400}
              height={930}
              className={styles.figImg}
              priority
            />
            <figcaption className={styles.figCap}>
              <span aria-hidden className={styles.figTick} />
              {'איור: המערכת · «הקול של הרבים נמדד»'}
            </figcaption>
          </figure>

          <div className={styles.byline}>
            <span>מאת המערכת</span>
            <span className={styles.sep} aria-hidden>■</span>
            <span>כל הארץ</span>
            <span className={styles.sep} aria-hidden>■</span>
            <span>04.08.26</span>
          </div>

          <div className={styles.actions}>
            <NewsButton href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" variant="red" size="lg" trailing={<span aria-hidden>←</span>}>
              קבוצת המייסדים
            </NewsButton>
            <a href={`/${locale}/how-it-works`} className={styles.textLink}>איך זה עובד ←</a>
          </div>
        </div>

        {/* Side briefs — "also in this issue" */}
        <aside className={styles.colBriefs}>
          <span className={styles.briefHead}>עוד בגיליון</span>
          <ul className={styles.briefs}>
            {BRIEFS.map((b, i) => (
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
            <span className={styles.priceK}>השתתפות</span>
            <span className={styles.priceNum}>חינם</span>
            <span className={styles.priceMeta}>בלי תשלום · זהות מאומתת · תוצאות שקופות</span>
          </div>

          <a href={`/${locale}/how-it-works`} className={styles.briefMore}>לכל הכלים ←</a>
        </aside>
      </div>

    </section>
  );
}
