'use client';

import Image from 'next/image';
import { NewsButton } from '@/components/press/NewsButton';
import { VoteWidget } from '@/components/press/VoteWidget';
import type { Locale } from '@/lib/i18n';
import styles from './Lead.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface LeadProps {
  locale?: Locale;
}

const BRIEFS = [
  { k: 'מודדים', t: 'כמה באמת תומכים, כמה מתנגדים — מספר מדויק, לא תחושת בטן.' },
  { k: 'מאמתים', t: 'כל קול הוא תושב אמיתי אחד. זהות ו-GPS, חתום בבלוקצ׳יין.' },
  { k: 'מנגישים', t: 'התמונה המלאה פתוחה לכולם. שקיפות מלאה, בלי חדרים סגורים.' },
];

export function Lead({ locale = 'he' }: LeadProps) {
  return (
    <section className={styles.lead}>
      <div className={styles.grid}>
        {/* Live ballot — participation control surface */}
        <aside className={styles.colBallot}>
          <VoteWidget />
        </aside>

        {/* Lead story */}
        <div className={styles.colStory}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הסיפור הראשי · עמוד 1
          </span>

          <h1 className={styles.headline}>
            הקול של השכונה. עכשיו <span className={styles.red}>במספרים.</span>
          </h1>

          <p className={styles.standfirst}>
            תַּרְאוּ מודד את עמדת רוב התושבים בנושאים המקומיים — מאומת, שקוף, ובלתי
            ניתן לזיוף. לא עוד צעקות בקבוצת הפייסבוק: תמונת מצב אחת שהמועצה לא יכולה
            להתעלם ממנה. כאן לא רק קוראים את העיתון — מצביעים בתוכו.
          </p>

          <figure className={styles.figure}>
            <Image
              src="/images/civic-engraving.png"
              alt="תושבים מרימים את קולם ואת פתקי ההצבעה — איור קונצנזוס ציבורי"
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
            <span>קריית טבעון</span>
            <span className={styles.sep} aria-hidden>■</span>
            <span>23.01.26</span>
          </div>

          <div className={styles.actions}>
            <NewsButton href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" variant="red" size="lg" trailing={<span aria-hidden>←</span>}>
              קבוצת המייסדים
            </NewsButton>
            <a href="#participate" className={styles.textLink}>איך משתתפים ↓</a>
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
            <span className={styles.priceK}>דמי השתתפות</span>
            <span className={styles.priceNum}>₪3</span>
            <span className={styles.priceMeta}>₪2 לקרן הקהילתית · ₪1 לתפעול</span>
          </div>

          <a href="#participate" className={styles.briefMore}>לכל הכלים ←</a>
        </aside>
      </div>
    </section>
  );
}
