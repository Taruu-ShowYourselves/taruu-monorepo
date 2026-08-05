import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { CountdownClock } from '@/components/press/Countdown/Countdown';
import { SubscribeForm } from './SubscribeForm';
import type { Locale } from '@/lib/i18n';
import styles from './Colophon.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface ColophonProps {
  locale?: Locale;
}

export function Colophon({ locale = 'he' }: ColophonProps) {
  return (
    <footer id="subscribe" className={styles.colophon}>
      {/* Subscribe */}
      <div className={styles.subscribe}>
        <div className={styles.subLeft}>
          <span className={styles.kicker}><span aria-hidden className={styles.tick} />הישארו מעודכנים · SUBSCRIBE</span>
          <h2 className={styles.subHead}>אל תפספסו את <span className={styles.red}>ההצבעה הראשונה.</span></h2>
        </div>
        <div className={styles.subRight}>
          <CountdownClock className={styles.countdown} />
          <SubscribeForm />
        </div>
      </div>

      <div className={styles.ruleMast} />

      {/* Colophon / imprint */}
      <div className={styles.imprint}>
        <div className={styles.brand}>
          <Link href={`/${locale}`} className={styles.wordmark}>תַּרְאוּ</Link>
          <p className={styles.tagline}>עיתון אזרחי. מודדים, מאמתים, מנגישים.</p>
          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="sm"
            className={styles.foundersCta}
            trailing={<span aria-hidden>←</span>}
          >
            קבוצת המייסדים
          </NewsButton>
        </div>

        <nav className={styles.cols} aria-label="ניווט תחתון">
          <div className={styles.col}>
            <span className={styles.colHead}>המוצר</span>
            <Link href={`/${locale}/about`}>אודות</Link>
            <Link href={`/${locale}/votes`}>הצבעות</Link>
            <Link href={`/${locale}/economics`}>כלכלה אזרחית</Link>
            <Link href={`/${locale}/treasury`}>שקיפות הקרן</Link>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>תמיכה</span>
            <Link href={`/${locale}/faq`}>שאלות נפוצות</Link>
            <Link href={`/${locale}/pricing`}>תמחור</Link>
            <Link href={`/${locale}/support`}>יצירת קשר</Link>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>משפטי</span>
            <Link href={`/${locale}/privacy`}>מדיניות פרטיות</Link>
            <Link href={`/${locale}/terms`}>תנאי שימוש</Link>
            <Link href={`/${locale}/refund`}>מדיניות החזרים</Link>
          </div>
        </nav>
      </div>

      <div className={styles.ruleHair} />
      <div className={styles.bottom}>
        <span>© 2026 תַּרְאוּ · כל הזכויות שמורות</span>
        <span>נבנה באהבה · saharbarak.dev</span>
      </div>
    </footer>
  );
}
