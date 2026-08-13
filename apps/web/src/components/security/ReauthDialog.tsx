'use client';

/**
 * Reauthentication prompt (canonical §11, engineering model §5.6a).
 *
 * Wraps POST /api/security/reauth: the user proves the second factor for a
 * specific purpose and the dialog hands the single-use ticket to the caller,
 * which replays it as X-Reauth-Ticket on the guarded call. Method options
 * follow the server-derived §7.2 matrix - for user-facing purposes that is
 * TOTP or recovery, never Google; operator_reset offers TOTP only.
 */

import { useState } from 'react';
import styles from './ReauthDialog.module.css';

export type ReauthPurpose =
  | 'mfa_disable'
  | 'recovery_regenerate'
  | 'operator_reset'
  | 'security_settings';

interface ReauthDialogProps {
  purpose: ReauthPurpose;
  title: string;
  description: string;
  /** Called with the minted ticket; the dialog closes on resolve. */
  onTicket: (ticket: string) => Promise<void> | void;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'הקוד שגוי. נסו שוב.',
  RATE_LIMITED: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.',
  REAUTH_UNAVAILABLE: 'אימות מחדש אינו זמין לחשבון זה.',
};

export function ReauthDialog({ purpose, title, description, onTicket, onClose }: ReauthDialogProps) {
  const allowRecovery = purpose !== 'operator_reset';
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/security/reauth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, code: code.trim() }),
      });
      const data = await response.json();

      if (response.ok && data.ticket) {
        await onTicket(data.ticket);
        onClose();
        return;
      }
      const messageCode = typeof data.code === 'string' ? data.code : 'INVALID_CODE';
      setError(ERROR_MESSAGES[messageCode] ?? ERROR_MESSAGES.INVALID_CODE);
      setCode('');
    } catch {
      setError('שגיאה זמנית. נסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" dir="rtl">
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <p className={styles.hint}>
          {mode === 'totp'
            ? 'הזינו את הקוד מאפליקציית האימות לאישור הפעולה.'
            : 'הזינו קוד שחזור לאישור הפעולה.'}
        </p>

        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            inputMode={mode === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            autoFocus
            dir="ltr"
            maxLength={mode === 'totp' ? 6 : 24}
            placeholder={mode === 'totp' ? '000000' : 'XXXX-XXXX-XXXX-XXXX'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose} disabled={busy}>
              ביטול
            </button>
            <button type="submit" className={styles.confirm} disabled={busy || !code.trim()}>
              {busy ? 'מאמת…' : 'אישור'}
            </button>
          </div>
        </form>

        {allowRecovery && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              setMode(mode === 'totp' ? 'recovery' : 'totp');
              setCode('');
              setError(null);
            }}
          >
            {mode === 'totp' ? 'השתמשו בקוד שחזור' : 'חזרה לקוד מהאפליקציה'}
          </button>
        )}
      </div>
    </div>
  );
}
