import React from 'react';
import clsx from 'clsx';
import kicker from './kicker.module.css';
import styles from './SpaceAdminHeader.module.css';

export interface SpaceAdminHeaderProps {
  /** Display name of the space, e.g. "עיריית חיפה". */
  spaceName: string;
  /** Human label for the space type, already localized by the caller. */
  spaceTypeLabel: string;
  /** URL slug of the space. Rendered LTR-isolated. */
  slug: string;
  /** Full space uuid. Only its first eight characters are shown. */
  spaceId: string;
  /** Edition date. Defaults to now. */
  date?: Date;
  /** Renders the SUSPENDED banner when the viewing admin is suspended. */
  suspended?: boolean;
  className?: string;
}

/**
 * Page masthead for every space-admin surface: kicker, `h1`, and a mono
 * edition-meta line. Rendered by each PAGE, never by the layout - a Next.js
 * layout does not re-render on navigation, so it cannot carry per-surface
 * space identity.
 */
export function SpaceAdminHeader({
  spaceName,
  spaceTypeLabel,
  slug,
  spaceId,
  date,
  suspended = false,
  className,
}: SpaceAdminHeaderProps) {
  const shortId = spaceId.slice(0, 8);
  const editionDate = (date ?? new Date()).toLocaleDateString('he-IL');

  return (
    <header className={clsx(styles.header, className)}>
      <span className={kicker.kicker}>
        <span aria-hidden className={kicker.tick}>
          ■
        </span>
        ניהול מרחב · SPACE ADMIN
      </span>

      <h1 className={styles.headline}>לוח הניהול - {spaceName}</h1>

      <p className={styles.meta}>
        <span>{spaceTypeLabel}</span>
        <span aria-hidden className={styles.sep}>
          ■
        </span>
        {/* Latin identifiers scramble in the RTL flow without an isolate. */}
        <span dir="ltr" className={styles.latin}>
          {slug}
        </span>
        <span aria-hidden className={styles.sep}>
          ■
        </span>
        <span>
          מזהה מרחב ·{' '}
          <span dir="ltr" className={styles.latin} title={spaceId}>
            {shortId}
          </span>
        </span>
        <span aria-hidden className={styles.sep}>
          ■
        </span>
        <span>{editionDate}</span>
      </p>

      {suspended ? (
        <div className={clsx('np-block-ink', styles.suspended)}>
          <span className={kicker.kickerOnInk}>
            <span aria-hidden className={kicker.tick}>
              ■
            </span>
            מושעה · SUSPENDED
          </span>
          <p className={styles.suspendedBody}>
            הגישה שלכם למרחב הזה הושעתה על ידי מנהל-על. ההיסטוריה והתיעוד
            נשמרים במלואם ואינם נמחקים. לבירור - פנו למנהל-על.
          </p>
        </div>
      ) : null}
    </header>
  );
}
