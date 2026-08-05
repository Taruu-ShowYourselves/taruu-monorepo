'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { NewsButton } from '@/components/press/NewsButton';
import { pressShake } from '@/components/press/PressForm/PressForm';
import styles from './SubscribeForm.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLACEHOLDER_EMAILS = [
  'noa.brenner@gmail.com',
  'amit.dahari@outlook.com',
  'shira.k@walla.co.il',
];

const TYPE_TICK_MS = 65;
const HOLD_TICKS = 26;
const GAP_TICKS = 7;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Colophon subscribe form. Placeholder types itself through real-looking
 * addresses, fields rise in on first view, rejection shakes, success lands
 * as a rotated press stamp.
 */
export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const [ph, setPh] = useState(PLACEHOLDER_EMAILS[0]);

  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stampRef = useRef<HTMLParagraphElement>(null);
  const pausedRef = useRef(false);

  /* Entrance: rise-in stagger on first view. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-rise]'));
    if (targets.length === 0) return;

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      animate(targets, {
        translateY: [16, 0],
        opacity: [0, 1],
        delay: stagger(90),
        duration: 620,
        ease: 'outExpo',
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      play();
      return;
    }
    targets.forEach((t) => { t.style.opacity = '0'; });
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  /* Typewriter placeholder; pauses while the field is focused or filled. */
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let i = 0;
    let pos = PLACEHOLDER_EMAILS[0].length;
    let dir: 1 | -1 = -1;
    let hold = HOLD_TICKS;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      if (hold > 0) { hold -= 1; return; }
      pos += dir;
      if (pos >= PLACEHOLDER_EMAILS[i].length) {
        pos = PLACEHOLDER_EMAILS[i].length;
        dir = -1;
        hold = HOLD_TICKS;
      } else if (pos <= 0 && dir === -1) {
        pos = 0;
        dir = 1;
        i = (i + 1) % PLACEHOLDER_EMAILS.length;
        hold = GAP_TICKS;
      }
      setPh(PLACEHOLDER_EMAILS[i].slice(0, pos));
    }, TYPE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /* Success: stamp slams in, then a single sheen sweep. */
  useEffect(() => {
    const stamp = stampRef.current;
    if (state !== 'ok' || !stamp || prefersReducedMotion()) return;
    animate(stamp, {
      scale: [1.5, 1],
      rotate: ['-7deg', '-2deg'],
      opacity: [0, 1],
      duration: 460,
      ease: 'outBack',
    });
    const sheen = stamp.querySelector<HTMLElement>('[data-sheen]');
    if (sheen) {
      animate(sheen, {
        translateX: ['-160%', '340%'],
        duration: 900,
        delay: 300,
        ease: 'inOutQuad',
      });
    }
  }, [state]);

  const fail = (text: string) => {
    setState('err');
    setMsg(text);
    pressShake(formRef.current);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      fail('כתובת האימייל לא נראית תקינה. בדקו ונסו שוב.');
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
        fail(d.message || 'משהו השתבש. נסו שוב.');
      }
    } catch {
      fail('משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.');
    }
  };

  const valid = EMAIL_RE.test(email.trim());

  return (
    <div ref={rootRef} className={styles.wrap}>
      {state === 'ok' ? (
        <p ref={stampRef} className={styles.stamp} role="status">
          <span aria-hidden data-sheen className={styles.sheen} />
          <span className={styles.stampMark} aria-hidden>✓</span>
          {msg}
        </p>
      ) : (
        <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
          <div className={styles.fieldBlock} data-rise>
            <div className={styles.fieldMast}>
              <span className={styles.fieldKicker}>
                <span aria-hidden className={styles.cursor} />
                האימייל שלכם · FIELD 01
              </span>
              <span className={styles.validity} data-on={valid || undefined} aria-hidden>
                OK
              </span>
            </div>
            <div className={styles.inputFrame}>
              <input
                className={styles.input}
                type="email"
                dir="ltr"
                placeholder={ph}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  pausedRef.current = e.target.value.length > 0;
                  if (state === 'err') setState('idle');
                }}
                onFocus={() => { pausedRef.current = true; }}
                onBlur={() => { pausedRef.current = email.length > 0; }}
                disabled={state === 'loading'}
                aria-label="כתובת אימייל"
              />
              <span aria-hidden className={styles.bar} />
            </div>
          </div>
          <div className={styles.action} data-rise>
            <NewsButton type="submit" variant="red" size="lg" disabled={state === 'loading'}>
              {state === 'loading' ? <span className={styles.sending}>שולח</span> : 'הירשמו'}
            </NewsButton>
          </div>
        </form>
      )}
      {state === 'err' && <p className={styles.err} role="alert">{msg}</p>}
    </div>
  );
}
