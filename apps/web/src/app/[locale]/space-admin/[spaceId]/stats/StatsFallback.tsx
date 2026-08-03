'use client';

/**
 * The two non-happy paths of Surface 4, and the only client code on it.
 *
 * The statistics surface itself is entirely server-rendered — that is how it
 * ends up with no click handler anywhere near a figure. These two panels need
 * a client boundary for a different reason: `NoPermissionPanel`'s escalation
 * CTA has to open a dialog, and `ErrorPanel`'s retry has to refresh the route.
 *
 * The escalation dialog is inlined here rather than shared. 05-12 is the plan
 * authorized to add a shared component this wave, and it is running now — a
 * page that imported one before it landed would break on a rename. 05-15
 * dedupes; this file and the members island are the two copies to fold in.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog, ErrorPanel, NoPermissionPanel } from '@/components/space-admin';
import styles from './page.module.css';

export interface StatsFallbackProps {
  kind: 'denied' | 'error';
  spaceId: string;
}

const ESCALATION_FAILED_HE =
  'הפנייה לא נשלחה. נסו שוב; אם זה חוזר — פנו למנהל־על בדרך אחרת.';

export function StatsFallback({ kind, spaceId }: StatsFallbackProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const send = async (body: string) => {
    setPending(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/space-admin/${spaceId}/escalations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        setFailure(ESCALATION_FAILED_HE);
        return;
      }
      setOpen(false);
      setAnnouncement('הפנייה נשלחה. מנהל־על יקבל אותה עם פרטי המרחב.');
    } catch {
      setFailure(ESCALATION_FAILED_HE);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>

      {kind === 'denied' ? (
        <NoPermissionPanel onEscalate={() => setOpen(true)} />
      ) : (
        <ErrorPanel onRetry={() => router.refresh()} />
      )}

      <ConfirmDialog
        kind="audited"
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setFailure(null);
        }}
        heading="פנייה למנהל־על"
        body="הפנייה נשלחת למנהלי הפלטפורמה יחד עם שם המרחב ועם החשבון שלכם."
        confirmLabel="שלחו פנייה"
        reasonLabel="מה תרצו לבקש? (חובה)"
        reasonError="נדרש תיאור — לפחות 10 תווים."
        placeholder="תארו מה חסם אתכם — למשל הרשאה שאתם צריכים, או השעיה שנראית לכם שגויה."
        unblockHint="התיאור נדרש כדי להמשיך."
        pending={pending}
        pendingLabel="…שולח"
        error={failure}
        onConfirm={(body) => {
          void send(body);
        }}
      />
    </>
  );
}
