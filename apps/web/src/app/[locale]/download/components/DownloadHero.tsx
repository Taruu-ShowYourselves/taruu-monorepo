'use client';

import { NewsButton } from '@/components/press';
import styles from './DownloadHero.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

/** Hard-edged ink Apple glyph, no rounding. */
function AppleGlyph() {
  return (
    <svg className={styles.storeGlyph} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

/** Hard-edged ink Play glyph, no rounding. */
function PlayGlyph() {
  return (
    <svg className={styles.storeGlyph} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z"
      />
    </svg>
  );
}

/** Hard-edged WhatsApp glyph for the primary action. */
function WhatsappGlyph() {
  return (
    <svg className={styles.waGlyph} viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M17.47 14.38c-.3-.15-1.74-.86-2-.95-.27-.1-.47-.15-.66.15-.2.3-.76.95-.93 1.15-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5-.17-.01-.37-.01-.56-.01-.2 0-.51.07-.78.37-.27.3-1.02 1-1.02 2.42 0 1.43 1.04 2.8 1.19 3 .15.2 2.05 3.13 4.96 4.39.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.74-.71 1.98-1.4.24-.69.24-1.28.17-1.4-.07-.13-.27-.2-.57-.35M12.04 2.5C6.81 2.5 2.56 6.75 2.56 11.98c0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.92-1.29a9.4 9.4 0 0 0 4.61 1.18h.01c5.23 0 9.48-4.25 9.48-9.48S17.27 2.5 12.04 2.5"
      />
    </svg>
  );
}

interface StoreBlock {
  name: string;
  glyph: React.ReactNode;
  pre: string;
}

const STORES: StoreBlock[] = [
  { name: 'App Store', glyph: <AppleGlyph />, pre: 'הורידו מ-' },
  { name: 'Google Play', glyph: <PlayGlyph />, pre: 'הורידו מ-' },
];

export function DownloadHero() {
  return (
    <section className={styles.hero} aria-labelledby="download-headline">
      <div className={styles.inner}>
        {/* Dateline — top of the dispatch */}
        <div className={styles.dateline}>
          <span className={`np-kicker ${styles.kicker}`}>
            מברק מהמערכת · COMING SOON
          </span>
          <span className={`np-mono ${styles.datelinePlace}`} aria-hidden>
            תַּרְאוּ · MOBILE
          </span>
        </div>

        <hr className="np-rule-heavy" />

        <div className={styles.grid}>
          {/* Editorial column — headline + dispatch body */}
          <div className={styles.story}>
            <h1 id="download-headline" className={styles.headline}>
              תַּרְאוּ בכיס שלכם
              <br />
              <span className={styles.red}>— בקרוב.</span>
            </h1>

            <p className={`np-dropcap ${styles.body}`}>
              האפליקציה תהיה זמינה ב-App Store וב-Google Play לקראת ההצבעה
              הראשונה. בינתיים — הצטרפו לוואטסאפ הפיילוט ותהיו הראשונים לדעת
              כשהיא יוצאת.
            </p>

            <div className={styles.actions}>
              <NewsButton
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                variant="red"
                size="lg"
                trailing={<span aria-hidden>←</span>}
              >
                <span className={styles.primaryLabel}>
                  <WhatsappGlyph />
                  הצטרפו לוואטסאפ הפיילוט
                </span>
              </NewsButton>
              <a href="#features" className={styles.textLink}>
                מה יהיה באפליקציה ↓
              </a>
            </div>
          </div>

          {/* Press furniture — store dispatch blocks marked "בקרוב" */}
          <aside className={styles.furniture}>
            <span className={`np-mono ${styles.furnitureLabel}`}>
              חנויות · STORES
            </span>

            <ul className={styles.stores} aria-label="חנויות אפליקציות — בקרוב">
              {STORES.map((store) => (
                <li
                  key={store.name}
                  className={styles.storeBlock}
                  data-disabled="true"
                >
                  <span className={styles.storeGlyphWrap} aria-hidden>
                    {store.glyph}
                  </span>
                  <span className={styles.storeText}>
                    <span className={`np-mono ${styles.storePre}`}>{store.pre}</span>
                    <span className={styles.storeName}>{store.name}</span>
                  </span>
                  <span className={`np-mono ${styles.storeStamp}`}>בקרוב</span>
                </li>
              ))}
            </ul>

            <p className={`np-mono ${styles.furnitureNote}`}>
              <span aria-hidden className={styles.noteTick}>■</span>
              הקישורים ייפתחו עם השקת הגרסה הראשונה.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
