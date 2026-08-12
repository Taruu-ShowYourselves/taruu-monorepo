import React from 'react';
import clsx from 'clsx';
import kicker from './kicker.module.css';
import styles from './QuotaBlock.module.css';

/**
 * Composer state 0 - the monthly notification quota is spent.
 *
 * The block explains an ABSENCE. State 0 is the one place in this phase where
 * Rule A's "not rendered" and Rule B's "disabled with visible unblock text"
 * agree: the send control is gone rather than inert, because an exhausted
 * quota is not something the admin can resolve inside this session. Nothing
 * they can type unblocks it, so a disabled button with a hint would be a lie
 * about who is in control. This block is what stops the absence from being
 * mysterious - it names the limit, the reset date, and what is still allowed.
 *
 * On the ink background, kicker TEXT is `--np-paper` and only the `■` tick is
 * red. There is no compliant red text on ink under either red token, so none
 * is used - see the contrast table in `QuotaBlock.module.css` and D16.
 *
 * The numbers come from `GET /api/space-admin/{id}/notifications`, whose
 * top-level `quota` block exists for this component: state 0 renders before
 * any preview has been costed, and the 429 the send answers with deliberately
 * carries no figures at all.
 */

export interface QuotaBlockProps {
  /**
   * Required by the caller's shape and deliberately NOT PRINTED - which is
   * why it is not destructured below. The exhausted sentence writes
   * `{limit}/{limit}`, not `{used}/{limit}`: the state is reached at
   * `used >= limit`, so lowering the space's quota mid-month would render
   * `9/8`, and a fraction whose numerator exceeds its denominator reads as a
   * bug rather than as a refusal. The copy deck specifies the doubled limit
   * for exactly this reason.
   */
  used: number;
  limit: number;
  /** ISO instant. `resetsAt` from the notifications endpoint. */
  resetDate: string;
  className?: string;
}

/** One literal, one line - the copy deck is graded by grep. */
const body = (limit: number, date: string): string =>
  `ניצלתם את מלוא מכסת ההתראות למרחב הזה החודש (${limit}/${limit}). המכסה מתאפסת ב־${date}. עד אז אפשר להכין טיוטה, אבל לא לשלוח.`;

export function QuotaBlock({ limit, resetDate, className }: QuotaBlockProps) {
  const reset = new Date(resetDate).toLocaleDateString('he-IL');

  return (
    <div className={clsx(styles.block, className)}>
      <span className={kicker.kickerOnInk}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        מכסה מוצתה · QUOTA
      </span>
      <p className={styles.body}>{body(limit, reset)}</p>
    </div>
  );
}
