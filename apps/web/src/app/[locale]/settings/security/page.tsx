'use client';

/**
 * Security settings (canonical §11, engineering model §10.1).
 *
 * MFA status + enrollment flow (QR / manual secret / confirm / one-time
 * recovery-code display), disable behind the ReauthDialog, recovery-code
 * count + regenerate, the security-score card at its explicit /20 maximum,
 * the recovery-login review banner (keyed off the session's amr), and the
 * user's own recent security events.
 */

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/providers/AuthProvider';
import { useAuthStore } from '@/stores/authStore';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ReauthDialog } from '@/components/security/ReauthDialog';
import styles from './page.module.css';

interface SecurityStatus {
  enrolled: boolean;
  enrolledAt: string | null;
  pendingEnrollment: boolean;
  recoveryCodesRemaining: number;
  enforcementEnabled: boolean;
  enrollmentAvailable: boolean;
  securityScore: number;
  amr: string[];
  events: Array<{ eventType: string; createdAt: string }>;
}

interface EnrollStart {
  otpauthUri: string;
  secret: string;
  expiresInMinutes: number;
}

const SECURITY_SCORE_MAX = 20;
const RECOVERY_LOW_WATERMARK = 2;

const EVENT_LABELS: Record<string, string> = {
  mfa_enrollment_started: 'התחלת רישום אימות דו-שלבי',
  mfa_enrollment_confirmed: 'אימות דו-שלבי הופעל',
  mfa_enrollment_failed: 'רישום אימות דו-שלבי נכשל',
  totp_verification_success: 'אימות קוד הצליח',
  totp_verification_failure: 'אימות קוד נכשל',
  recovery_code_used: 'קוד שחזור שימש להתחברות',
  recovery_code_failed: 'ניסיון קוד שחזור נכשל',
  recovery_codes_regenerated: 'קודי שחזור חודשו',
  mfa_disabled: 'אימות דו-שלבי הושבת',
  mfa_reset_by_operator: 'אימות דו-שלבי אופס על ידי התמיכה',
  reauth_success: 'אימות מחדש הצליח',
  reauth_failure: 'אימות מחדש נכשל',
  mfa_challenge_expired: 'אימות התחברות פג',
  mfa_challenge_replayed: 'ניסיון שימוש חוזר באימות',
  session_version_revoked: 'כל ההתחברויות נותקו',
};

export default function SecuritySettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { setTokens } = useAuthStore();

  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollStart | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);
  const [reauthFor, setReauthFor] = useState<'mfa_disable' | 'recovery_regenerate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/security/status', { credentials: 'include' });
      if (response.ok) setStatus(await response.json());
    } catch {
      // The page renders a retry state below.
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void loadStatus();
  }, [isAuthenticated, loadStatus]);

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/security/mfa/enroll', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setEnrollment(data);
      } else {
        setError(data.code === 'RATE_LIMITED' ? 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' : 'הרישום נכשל. נסו שוב.');
      }
    } catch {
      setError('שגיאה זמנית. נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !confirmCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/security/mfa/enroll/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.recoveryCodes) {
        setEnrollment(null);
        setConfirmCode('');
        setRecoveryCodes(data.recoveryCodes);
        setCodesAcknowledged(false);
        await loadStatus();
      } else if (data.code === 'ENROLLMENT_RESTART_REQUIRED' || data.code === 'NO_PENDING_ENROLLMENT') {
        setEnrollment(null);
        setConfirmCode('');
        setError('הרישום פג. התחילו מחדש.');
      } else {
        setError('הקוד שגוי. נסו שוב.');
        setConfirmCode('');
      }
    } catch {
      setError('שגיאה זמנית. נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function disableWithTicket(ticket: string) {
    const response = await fetch('/api/security/mfa/disable', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Reauth-Ticket': ticket },
    });
    const data = await response.json();
    if (response.ok) {
      // The response re-mints this session with the new sv - every other
      // device is signed out from its next request.
      if (data.accessToken) setTokens(data.accessToken, data.refreshToken);
      setNotice('אימות דו-שלבי הושבת. כל ההתחברויות האחרות נותקו.');
      await loadStatus();
    } else {
      setError('ההשבתה נכשלה. נסו שוב.');
    }
  }

  async function regenerateWithTicket(ticket: string) {
    const response = await fetch('/api/security/mfa/recovery/regenerate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Reauth-Ticket': ticket },
    });
    const data = await response.json();
    if (response.ok && data.recoveryCodes) {
      setRecoveryCodes(data.recoveryCodes);
      setCodesAcknowledged(false);
      setNotice('קודי שחזור חדשים נוצרו. הקודים הקודמים בוטלו.');
      await loadStatus();
    } else {
      setError('חידוש הקודים נכשל. נסו שוב.');
    }
  }

  function copyCodes() {
    if (recoveryCodes) void navigator.clipboard.writeText(recoveryCodes.join('\n'));
  }

  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <div className={styles.page} dir="rtl">
        <Header />
        <main className={styles.main}>
          <p>יש להתחבר כדי לצפות בהגדרות האבטחה.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const usedRecoveryThisSession = status?.amr?.includes('recovery') ?? false;

  return (
    <div className={styles.page} dir="rtl">
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>אבטחת החשבון</h1>

        {usedRecoveryThisSession && (
          <div className={styles.recoveryBanner}>
            התחברתם עם קוד שחזור. מומלץ לוודא שיש לכם גישה לאפליקציית האימות ולחדש את קודי השחזור.
          </div>
        )}

        {notice && <div className={styles.notice}>{notice}</div>}
        {error && <div className={styles.errorBox}>{error}</div>}

        {!status ? (
          <p className={styles.muted}>טוען…</p>
        ) : (
          <>
            {/* Security score - rendered against its explicit /20 maximum. */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>ציון אבטחה</h2>
              <div className={styles.scoreRow}>
                <span className={styles.scoreValue}>
                  {status.securityScore}/{SECURITY_SCORE_MAX}
                </span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreFill}
                    style={{ width: `${(status.securityScore / SECURITY_SCORE_MAX) * 100}%` }}
                  />
                </div>
              </div>
              <p className={styles.muted}>
                {status.enrolled && !status.enforcementEnabled
                  ? 'אימות דו-שלבי פעיל. הניקוד יתווסף כשאכיפת האימות תופעל לכלל המשתמשים.'
                  : 'ציון האבטחה משקף אימות דו-שלבי פעיל ונאכף. הוא אינו משפיע על הזכאות להצביע.'}
              </p>
            </section>

            {/* MFA status + enroll/disable */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>אימות דו-שלבי (אפליקציית אימות)</h2>

              {status.enrolled ? (
                <>
                  <p className={styles.statusOn}>פעיל{status.enrolledAt ? ` מאז ${new Date(status.enrolledAt).toLocaleDateString('he-IL')}` : ''}</p>
                  <p className={styles.muted}>
                    קודי שחזור שנותרו: {status.recoveryCodesRemaining}
                    {status.recoveryCodesRemaining <= RECOVERY_LOW_WATERMARK && ' - מומלץ לחדש'}
                  </p>
                  <div className={styles.buttonRow}>
                    {status.enrollmentAvailable && (
                      <button
                        className={styles.secondaryButton}
                        onClick={() => setReauthFor('recovery_regenerate')}
                        disabled={busy}
                      >
                        חידוש קודי שחזור
                      </button>
                    )}
                    <button
                      className={styles.dangerButton}
                      onClick={() => setReauthFor('mfa_disable')}
                      disabled={busy}
                    >
                      השבתת אימות דו-שלבי
                    </button>
                  </div>
                  <p className={styles.smallPrint}>
                    השבתה תנתק את כל ההתחברויות הפעילות ותסיר את ציון האבטחה.
                  </p>
                </>
              ) : enrollment ? (
                <div className={styles.enrollFlow}>
                  <p className={styles.muted}>
                    סרקו את הקוד באפליקציית אימות (Google Authenticator וכדומה), או הזינו את
                    המפתח ידנית. הקוד תקף ל-{enrollment.expiresInMinutes} דקות.
                  </p>
                  <div className={styles.qrWrap}>
                    <QRCodeSVG value={enrollment.otpauthUri} size={180} />
                  </div>
                  <code className={styles.secret} dir="ltr">{enrollment.secret}</code>
                  <form onSubmit={confirmEnrollment} className={styles.confirmForm}>
                    <input
                      className={styles.codeInput}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      dir="ltr"
                      maxLength={6}
                      placeholder="000000"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      disabled={busy}
                    />
                    <button className={styles.primaryButton} type="submit" disabled={busy || !confirmCode.trim()}>
                      {busy ? 'מאמת…' : 'אישור והפעלה'}
                    </button>
                  </form>
                </div>
              ) : status.enrollmentAvailable ? (
                <>
                  <p className={styles.muted}>
                    הוסיפו שכבת הגנה: קוד חד-פעמי מאפליקציית אימות בכל התחברות.
                  </p>
                  <button className={styles.primaryButton} onClick={startEnrollment} disabled={busy}>
                    {busy ? 'מכין…' : 'הפעלת אימות דו-שלבי'}
                  </button>
                </>
              ) : (
                <p className={styles.muted}>הרשמה לאימות דו-שלבי אינה זמינה כרגע.</p>
              )}
            </section>

            {/* Recent security events */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>פעילות אבטחה אחרונה</h2>
              {status.events.length === 0 ? (
                <p className={styles.muted}>אין אירועים.</p>
              ) : (
                <ul className={styles.eventList}>
                  {status.events.map((event, i) => (
                    <li key={i} className={styles.eventRow}>
                      <span>{EVENT_LABELS[event.eventType] ?? event.eventType}</span>
                      <time className={styles.eventTime}>
                        {new Date(event.createdAt).toLocaleString('he-IL')}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />

      {/* One-time recovery-code display - never retrievable again. */}
      {recoveryCodes && (
        <div className={styles.codesBackdrop} role="dialog" aria-modal="true">
          <div className={styles.codesDialog}>
            <h2 className={styles.cardTitle}>קודי השחזור שלכם</h2>
            <p className={styles.muted}>
              שמרו את הקודים במקום בטוח. הם מוצגים פעם אחת בלבד ולא ניתן לשחזרם.
              כל קוד ניתן לשימוש פעם אחת.
            </p>
            <div className={styles.codesGrid} dir="ltr">
              {recoveryCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
            <button className={styles.secondaryButton} onClick={copyCodes}>העתקת הקודים</button>
            <label className={styles.ackRow}>
              <input
                type="checkbox"
                checked={codesAcknowledged}
                onChange={(e) => setCodesAcknowledged(e.target.checked)}
              />
              שמרתי את הקודים במקום בטוח
            </label>
            <button
              className={styles.primaryButton}
              disabled={!codesAcknowledged}
              onClick={() => setRecoveryCodes(null)}
            >
              סיום
            </button>
          </div>
        </div>
      )}

      {reauthFor === 'mfa_disable' && (
        <ReauthDialog
          purpose="mfa_disable"
          title="השבתת אימות דו-שלבי"
          description="פעולה רגישה: נדרש אימות נוסף. ההשבתה תנתק את כל ההתחברויות האחרות."
          onTicket={disableWithTicket}
          onClose={() => setReauthFor(null)}
        />
      )}
      {reauthFor === 'recovery_regenerate' && (
        <ReauthDialog
          purpose="recovery_regenerate"
          title="חידוש קודי שחזור"
          description="הקודים הקיימים יבוטלו ותקבלו עשרה קודים חדשים."
          onTicket={regenerateWithTicket}
          onClose={() => setReauthFor(null)}
        />
      )}
    </div>
  );
}
