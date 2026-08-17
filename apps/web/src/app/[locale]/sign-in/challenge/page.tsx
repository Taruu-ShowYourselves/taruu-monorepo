'use client';

/**
 * MFA login challenge (engineering model §5.5, canonical §11).
 *
 * Reached from the sign-in flow when the callback answered MFA_REQUIRED. At
 * this point NO session exists - only the httpOnly sync-mfa-pending cookie.
 * The user submits a 6-digit authenticator code (or toggles to a recovery
 * code); success stores the minted tokens and continues to the dashboard.
 * An expired/exhausted challenge restarts the login.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import styles from './page.module.css';

type Mode = 'totp' | 'recovery';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'הקוד שגוי. נסו שוב.',
  CHALLENGE_EXPIRED: 'זמן האימות פג. יש להתחבר מחדש.',
  CHALLENGE_REPLAYED: 'האימות כבר הושלם או בוטל. יש להתחבר מחדש.',
  CHALLENGE_EXHAUSTED: 'יותר מדי ניסיונות. יש להתחבר מחדש.',
  NO_PENDING_CHALLENGE: 'לא נמצא אימות פעיל. יש להתחבר מחדש.',
  INVALID_CHALLENGE: 'לא נמצא אימות פעיל. יש להתחבר מחדש.',
  RATE_LIMITED: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
};

/** Codes after which the only way forward is a fresh login. */
const RESTART_CODES = new Set([
  'CHALLENGE_EXPIRED',
  'CHALLENGE_REPLAYED',
  'CHALLENGE_EXHAUSTED',
  'NO_PENDING_CHALLENGE',
  'INVALID_CHALLENGE',
]);

export default function ChallengePage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [mode, setMode] = useState<Mode>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mustRestart, setMustRestart] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !code.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setTokens(data.accessToken, data.refreshToken, data.expiresAt);
        if (data.user) setUser(data.user);
        router.push('/dashboard');
        return;
      }

      const messageCode = typeof data.code === 'string' ? data.code : 'INVALID_CODE';
      setError(ERROR_MESSAGES[messageCode] ?? ERROR_MESSAGES.INVALID_CODE);
      if (RESTART_CODES.has(messageCode)) setMustRestart(true);
      if (typeof data.attemptsRemaining === 'number') {
        setAttemptsRemaining(data.attemptsRemaining);
      }
      setCode('');
    } catch {
      setError('שגיאה זמנית. נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.card}>
        <h1 className={styles.title}>אימות דו-שלבי</h1>

        {mode === 'totp' ? (
          <p className={styles.subtitle}>הזינו את הקוד בן 6 הספרות מאפליקציית האימות שלכם.</p>
        ) : (
          <p className={styles.subtitle}>הזינו אחד מקודי השחזור ששמרתם בעת ההרשמה לאימות הדו-שלבי.</p>
        )}

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.codeInput}
            type="text"
            inputMode={mode === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            autoFocus
            dir="ltr"
            maxLength={mode === 'totp' ? 6 : 24}
            placeholder={mode === 'totp' ? '000000' : 'XXXX-XXXX-XXXX-XXXX'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={submitting || mustRestart}
          />

          {error && <p className={styles.error}>{error}</p>}
          {attemptsRemaining !== null && !mustRestart && (
            <p className={styles.attempts}>נותרו {attemptsRemaining} ניסיונות</p>
          )}

          {mustRestart ? (
            <Link href="/sign-in" className={styles.submit}>
              חזרה להתחברות
            </Link>
          ) : (
            <button type="submit" className={styles.submit} disabled={submitting || !code.trim()}>
              {submitting ? 'מאמת…' : 'אימות'}
            </button>
          )}
        </form>

        {!mustRestart && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              setMode(mode === 'totp' ? 'recovery' : 'totp');
              setCode('');
              setError(null);
            }}
          >
            {mode === 'totp' ? 'איבדתם גישה לאפליקציה? השתמשו בקוד שחזור' : 'חזרה לקוד מהאפליקציה'}
          </button>
        )}
      </div>
    </div>
  );
}
