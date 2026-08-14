'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { chime } from '@/lib/feedback/chime';
import { DeskPanelActiveContext } from './deskPanelActive';
import styles from './DeskTabs.module.css';

/**
 * The desk, as one section with two editions.
 *
 * The two carousels used to run as separate full sections, each with its own
 * kicker, headline and standfirst - two screens of argument in front of the
 * tiles. A reader arriving at the front page wants to see what is open, not
 * choose between headlines about headlines; the tabs carry the two names and
 * the section gives the whole viewport to the river itself.
 *
 * The panels are server-rendered children. Both stay in the DOM: the inactive
 * one is hidden with `visibility` rather than unmounted, so its Embla track
 * keeps its measurements and its position, and switching back is instant. It
 * is also `inert`, so the hidden desk holds neither focus nor a screen
 * reader's attention.
 */

type DeskTab = 'local' | 'national';

interface DeskTabsCopy {
  sectionLabel: string;
  tablistLabel: string;
  localTab: string;
  nationalTab: string;
}

const COPY: Record<Locale, DeskTabsCopy> = {
  he: {
    sectionLabel: 'נושאי ההצבעה',
    tablistLabel: 'בחירת מהדורה',
    localTab: 'מועצות מקומיות',
    nationalTab: 'ממשלה',
  },
  en: {
    sectionLabel: 'The open ballots',
    tablistLabel: 'Choose an edition',
    localTab: 'Local councils',
    nationalTab: 'Government',
  },
};

const TABS: DeskTab[] = ['local', 'national'];

interface DeskTabsProps {
  locale?: Locale;
  /** The municipal desk, embedded: stream and dial, no section chrome. */
  localPanel: ReactNode;
  /** The national desk, embedded. */
  nationalPanel: ReactNode;
}

export function DeskTabs({
  locale = 'he',
  localPanel,
  nationalPanel,
}: DeskTabsProps) {
  const t = COPY[locale];
  const [active, setActive] = useState<DeskTab>('local');
  const tabRefs = useRef<Partial<Record<DeskTab, HTMLButtonElement | null>>>({});

  /* `#knesset-desk` predates the tabs - the Knesset page links back to it.
     The anchor now lands on this section with the national edition open. */
  useEffect(() => {
    const applyHash = () => {
      if (window.location.hash === '#knesset-desk') setActive('national');
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  /* Roving tabindex, per the tabs pattern: arrows move between the two tabs,
     Home/End jump. The arrow keys are physical, so RTL flips which one is
     "next" - the browser already reports them unflipped, and a reader's right
     arrow should move toward the tab printed to the right. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const rtl = locale === 'he';
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
      let next: DeskTab | null = null;

      if (event.key === forward) {
        next = TABS[(TABS.indexOf(active) + 1) % TABS.length];
      } else if (event.key === backward) {
        next = TABS[(TABS.indexOf(active) + TABS.length - 1) % TABS.length];
      } else if (event.key === 'Home') {
        next = TABS[0];
      } else if (event.key === 'End') {
        next = TABS[TABS.length - 1];
      }

      if (!next) return;
      event.preventDefault();
      /* The tick marks a change of edition, so Home on the first tab and
         End on the last stay silent - the arrows always wrap to the other. */
      if (next !== active) chime('tick');
      setActive(next);
      tabRefs.current[next]?.focus();
    },
    [active, locale]
  );

  const tabId = (tab: DeskTab) => `desk-tab-${tab}`;
  /* The national panel keeps the pre-tabs `#knesset-desk` id - see below. */
  const panelId = (tab: DeskTab) =>
    tab === 'national' ? 'knesset-desk' : 'desk-panel-local';

  return (
    <section
      id="consensus-desk"
      data-nav-reveal=""
      className={styles.section}
      aria-labelledby="consensus-desk-headline"
    >
      {/* The desks' visible h2s went with their section chrome, and the tab
          buttons are display type, not headings - so the page outline gets
          its entry point back here, off-screen. Dozens of tile h3s with no
          h2 above them is a page a screen reader cannot skim. */}
      <h2 id="consensus-desk-headline" className={styles.srHeading}>
        {t.sectionLabel}
      </h2>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={t.tablistLabel}
        onKeyDown={onKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            aria-selected={active === tab}
            aria-controls={panelId(tab)}
            tabIndex={active === tab ? 0 : -1}
            className={styles.tab}
            onClick={() => {
              /* Silent on the tab that is already open - the tick belongs
                 to the switch, not the press. */
              if (tab !== active) chime('tick');
              setActive(tab);
            }}
          >
            {tab === 'local' ? t.localTab : t.nationalTab}
          </button>
        ))}
      </div>

      <div className={styles.panels}>
        <div
          role="tabpanel"
          id={panelId('local')}
          aria-labelledby={tabId('local')}
          className={active === 'local' ? styles.panelActive : styles.panel}
          inert={active !== 'local' || undefined}
        >
          <DeskPanelActiveContext.Provider value={active === 'local'}>
            {localPanel}
          </DeskPanelActiveContext.Provider>
        </div>
        <div
          role="tabpanel"
          /* `panelId` resolves to the pre-tabs `#knesset-desk` anchor here:
             the Knesset page links back to it, and the hash effect above
             opens this tab when the anchor is followed. */
          id={panelId('national')}
          aria-labelledby={tabId('national')}
          className={`${
            active === 'national' ? styles.panelActive : styles.panel
          } ${styles.panelNational}`}
          inert={active !== 'national' || undefined}
        >
          <DeskPanelActiveContext.Provider value={active === 'national'}>
            {nationalPanel}
          </DeskPanelActiveContext.Provider>
        </div>
      </div>
    </section>
  );
}
