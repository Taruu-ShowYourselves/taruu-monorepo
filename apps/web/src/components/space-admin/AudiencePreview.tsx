'use client';

import React from 'react';
import clsx from 'clsx';
import { Receipt } from '@/components/press';
import { ReceiptKicker } from './ReceiptKicker';
import styles from './AudiencePreview.module.css';

/**
 * The costed audience (SPACE-08), rendered as a press `Receipt`.
 *
 * TWO PROPERTIES ARE LOAD-BEARING.
 *
 * 1. ALL FOUR ROWS ALWAYS RENDER, zeros included. The array below is built
 *    literally and is never filtered on truthiness, because a dropped row does
 *    not read as "zero" — it reads as "not checked", which is the precise
 *    ambiguity the preview exists to remove. `AudiencePreviewResponseSchema`
 *    guarantees all four numbers arrive, including on an empty audience.
 *
 * 2. NOTHING HERE COMPUTES AN AUDIENCE. This component receives four counts
 *    and prints them. It holds no user ids, and the composer above it holds
 *    none either — the recipient set is resolved once on the server by
 *    `resolveAudience`, which the send re-runs and fingerprints against what
 *    was shown. That is what makes "delivered equals previewed" structural
 *    rather than a promise.
 *
 * The stale treatment is part of this component rather than the composer's,
 * so the banner cannot drift away from the panel it invalidates.
 */

export interface AudiencePreviewProps {
  approvedRecipients: number;
  excludedOptedOut: number;
  excludedNoChannel: number;
  quotaUsed: number;
  quotaLimit: number;
  /** ISO instant from the preview response. Rendered as HH:MM. */
  computedAt: string;
  /**
   * The title, body or audience has changed since this was costed. The panel
   * dims and the banner appears; the composer separately removes the send.
   */
  stale?: boolean;
  className?: string;
}

const STALE_HE = 'ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.';

const footer = (time: string): string =>
  `התצוגה חושבה ב־${time} · הנמענים שיקבלו בפועל זהים לרשימה שחושבה כאן.`;

/** State 2: the resolver is running. `aria-busy` is set by the caller. */
export function AudiencePreviewComputing({ className }: { className?: string }) {
  return <p className={clsx(styles.computing, className)}>…מחשב קהל יעד</p>;
}

export function AudiencePreview({
  approvedRecipients,
  excludedOptedOut,
  excludedNoChannel,
  quotaUsed,
  quotaLimit,
  computedAt,
  stale = false,
  className,
}: AudiencePreviewProps) {
  const time = new Date(computedAt).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={clsx(styles.wrap, className)}>
      {/* No live-region role here. The composer owns the single polite
          announcement for this transition, and a second one on the banner
          would read the same event to a screen reader twice, in two
          different sentences. */}
      {stale ? (
        <p className={styles.staleBanner}>
          <span aria-hidden>▍</span>
          {STALE_HE}
        </p>
      ) : null}

      <Receipt
        className={stale ? styles.stale : undefined}
        kicker={<ReceiptKicker>קהל יעד · AUDIENCE</ReceiptKicker>}
        rows={[
          { label: 'נמענים מאושרים', value: approvedRecipients, strong: true },
          { label: 'הוחרגו — ביטלו הסכמה', value: excludedOptedOut },
          { label: 'הוחרגו — ללא ערוץ פעיל', value: excludedNoChannel },
          { label: 'מכסה חודשית', value: `${quotaUsed}/${quotaLimit}` },
        ]}
        footer={footer(time)}
      />
    </div>
  );
}
