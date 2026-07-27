'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { CountdownClock } from '@/components/press/Countdown/Countdown';
import type { Locale } from '@/lib/i18n';
import styles from './Colophon.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface ColophonProps {
  locale?: Locale;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Colophon({ locale = 'he' }: ColophonProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      setState('err');
      setMsg('כתובת האימייל לא נראית תקינה — אפשר לבדוק שוב?');
      return;
    }
    setState('loading');
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, source: 'homepage_cta' }),
      });
      const d = await r.json();
      if (d.success) {
        setState('ok');
        setMsg(d.message || 'אתם בפנים. נעדכן אתכם ברגע שההצבעה תיפתח.');
        setEmail('');
      } else {
        setState('err');
        setMsg(d.message || 'משהו השתבש. נסו שוב.');
      }
    } catch {
      setState('err');
      setMsg('משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.');
    }
  };

  return (
    <footer id="subscribe" className={styles.colophon}>
      {/* Subscribe */}
      <div className={styles.subscribe}>
        <div className={styles.subLeft}>
          <span className={styles.kicker}><span aria-hidden className={styles.tick} />הישארו מעודכנים · SUBSCRIBE</span>
          <h2 className={styles.subHead}>אל תפספסו את <span className={styles.red}>ההצבעה הראשונה.</span></h2>
          <p className={styles.subText}>עדכון אחד לפני שההצבעה נפתחת ב-04.08.26. בלי ספאם, בלי אותיות קטנות.</p>
        </div>
        <div className={styles.subRight}>
          <CountdownClock className={styles.countdown} />
          {state === 'ok' ? (
            <p className={styles.ok}><span aria-hidden>✓</span> {msg}</p>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <label className={styles.fieldLabel}>
                <span className={styles.fieldKicker}>האימייל שלכם</span>
                <input
                  className={styles.input}
                  type="email"
                  dir="ltr"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === 'err') setState('idle'); }}
                  disabled={state === 'loading'}
                  aria-label="כתובת אימייל"
                />
              </label>
              <NewsButton type="submit" variant="red" size="md">
                {state === 'loading' ? 'שולח…' : 'הירשמו'}
              </NewsButton>
            </form>
          )}
          {state === 'err' && <p className={styles.err}>{msg}</p>}
        </div>
      </div>

      <div className={styles.ruleMast} />

      {/* Colophon / imprint */}
      <div className={styles.imprint}>
        <div className={styles.brand}>
          <Link href={`/${locale}`} className={styles.wordmark}>תַּרְאוּ</Link>
          <p className={styles.tagline}>הקול שלכם. הקהילה שלכם. העתיד שלנו.</p>
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
