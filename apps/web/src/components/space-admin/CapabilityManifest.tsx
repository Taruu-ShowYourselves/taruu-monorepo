import React from 'react';
import clsx from 'clsx';
import {
  CAPABILITIES,
  CAPABILITY_LABELS_HE,
  type Capability,
} from '@/server/domain/space/capability';
import styles from './CapabilityManifest.module.css';

/**
 * The capability manifest - what makes Rule A humane instead of mysterious.
 *
 * Rule A says a control the admin holds no capability for is not rendered at
 * all: not disabled, not greyed, not tooltip-explained. That is only fair if
 * there is one authoritative place saying what they *do* hold, and this is it.
 * Every absence anywhere on the dashboard is explained here.
 *
 * It maps over `CAPABILITIES` from the domain vocabulary rather than a list of
 * its own, so a twelfth capability becomes a twelfth row without anyone
 * remembering to edit this file - and a manifest that silently omitted a
 * capability would be worse than no manifest at all.
 *
 * The two row states render exactly as `✓ מוענק` and `✕ לא מוענק`. They are
 * stored split below because the glyph is decorative and `aria-hidden`: the
 * meaning has to live in the Hebrew word beside it, never in the mark, or the
 * row says nothing to a screen reader.
 */
const ROW_STATES = {
  granted: { mark: '✓', label: 'מוענק' },
  withheld: { mark: '✕', label: 'לא מוענק' },
} as const;

/** Copy-deck string, kept on one line so it stays one greppable literal. */
const MANIFEST_NOTE =
  'הרשאות נבדקות בשרת בכל פעולה. פעולה שלא הוענקה לכם פשוט לא מוצגת בלוח - היא לא מוסתרת מאחורי כפתור כבוי.';

export interface CapabilityManifestProps {
  /** What this viewer holds in this space. Everything else renders withheld. */
  granted: readonly Capability[];
  className?: string;
}

export function CapabilityManifest({ granted, className }: CapabilityManifestProps) {
  const held = new Set<Capability>(granted);

  return (
    <div className={clsx(styles.manifest, className)}>
      {/* A description list, not a table: eleven label/state pairs are a list,
          and a table would promise columns to assistive tech that do not exist. */}
      <dl className={styles.rows}>
        {CAPABILITIES.map((capability) => {
          const isHeld = held.has(capability);
          const state = isHeld ? ROW_STATES.granted : ROW_STATES.withheld;

          return (
            <React.Fragment key={capability}>
              <dt className={styles.label}>{CAPABILITY_LABELS_HE[capability]}</dt>
              <dd className={clsx(styles.state, !isHeld && styles.stateWithheld)}>
                <span aria-hidden className={styles.mark}>
                  {state.mark}
                </span>
                {state.label}
              </dd>
            </React.Fragment>
          );
        })}
      </dl>

      <p className={styles.note}>{MANIFEST_NOTE}</p>
    </div>
  );
}
