'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  CinematicIntro,
  type IntroStory,
} from '@/components/press/CinematicIntro/CinematicIntro';
import styles from './HomepageExperience.module.css';

interface HomepageCopy {
  dashboardAria: string;
  closeAria: string;
  close: string;
}

const COPY: Record<Locale, HomepageCopy> = {
  he: {
    dashboardAria: 'דאשבורד אירועים בזמן אמת',
    closeAria: 'סגירת הדאשבורד',
    close: 'סגירה',
  },
  en: {
    dashboardAria: 'Live events dashboard',
    closeAria: 'Close the dashboard',
    close: 'Close',
  },
};

interface HomepageExperienceProps {
  children: ReactNode;
  liveDashboard?: ReactNode;
  locale?: Locale;
  /** How much of the cinematic intro to run before the site layer docks. */
  introStory?: IntroStory;
  /** Server-rendered backdrop per thesis beat after the first. */
  introBeatStages?: ReactNode[];
  /** The live desk, for the intro's `tiles` backdrop. */
  introDeskBackdrop?: ReactNode;
}

export function HomepageExperience({
  children,
  liveDashboard,
  locale = 'he',
  introStory = 'full',
  introBeatStages,
  introDeskBackdrop,
}: HomepageExperienceProps) {
  const t = COPY[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // The overlay used to mount permanently and let :target hide it - which
  // left its clock ticking every second, its event rail rotating and its 30s
  // poll polling behind a display:none. Mount it only while the hash names
  // it.
  //
  // `hashchange` alone is not enough to know when that is. The masthead's
  // opener is a next/link, and the App Router applies same-page hash
  // navigations with history.pushState - which, per spec, never fires
  // hashchange (the old :target styling was deaf to it for the same reason).
  // So the anchors themselves are listened to: a click on any link whose
  // fragment names the dashboard drives the state directly, hashchange keeps
  // covering native fragment navigation (the plain <a> close link), popstate
  // covers back/forward, and the mount-time read covers arriving with the
  // hash already in the URL.
  useEffect(() => {
    const sync = () =>
      setDashboardOpen(window.location.hash === '#live-dashboard');
    const onClick = (evt: MouseEvent) => {
      const anchor = (evt.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      const hash = (anchor as HTMLAnchorElement).hash;
      if (hash === '#live-dashboard') setDashboardOpen(true);
      else if (hash === '#dashboard-closed') setDashboardOpen(false);
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || shouldReduceMotion) return;
    const scopeRoot = root;

    let cancelled = false;
    let revert = () => {};

    async function buildHandoff() {
      const [gsapModule, scrollTriggerModule] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger.js'),
      ]);
      if (cancelled || !rootRef.current) return;

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        const dock = scopeRoot.querySelector<HTMLElement>('[data-site-dock]');
        const site = scopeRoot.querySelector<HTMLElement>('[data-site-layer]');
        const stage = scopeRoot.querySelector<HTMLElement>('[data-cinematic-stage]');
        if (!dock || !site || !stage) return;

        gsap.fromTo(
          site,
          {
            y: 0,
            scale: 0.985,
            borderRadius: 0,
            boxShadow: '0 -28px 70px rgba(20, 17, 14, 0.16)',
          },
          {
            y: 0,
            scale: 1,
            borderRadius: 0,
            boxShadow: '0 -12px 38px rgba(20, 17, 14, 0)',
            ease: 'none',
            scrollTrigger: {
              trigger: dock,
              start: 'top bottom',
              end: 'top top',
              scrub: 0.75,
              invalidateOnRefresh: true,
            },
          }
        );

        gsap.to(stage, {
          yPercent: -100,
          scale: 1,
          filter: 'none',
          ease: 'none',
          scrollTrigger: {
            trigger: dock,
            start: 'top bottom',
            end: 'top top',
            scrub: 0.75,
            invalidateOnRefresh: true,
          },
        });

        ScrollTrigger.refresh();
      }, scopeRoot);

      revert = () => context.revert();
    }

    void buildHandoff();
    return () => {
      cancelled = true;
      revert();
    };
  }, [shouldReduceMotion]);

  return (
    <div
      ref={rootRef}
      className={`${styles.experience} ${shouldReduceMotion ? styles.reduced : ''}`}
    >
      <CinematicIntro
        locale={locale}
        story={introStory}
        beatStages={introBeatStages}
        deskBackdrop={introDeskBackdrop}
      />
      <div className={styles.siteDock} data-site-dock>
        <div className={styles.siteLayer} data-site-layer>
          {children}
        </div>
      </div>
      {liveDashboard && dashboardOpen && (
        <div
          id="live-dashboard"
          className={`${styles.liveOverlay} ${styles.liveOverlayOpen}`}
          role="dialog"
          aria-modal="true"
          aria-label={t.dashboardAria}
        >
          <a
            href="#dashboard-closed"
            className={styles.liveOverlayClose}
            aria-label={t.closeAria}
          >
            {t.close} <span aria-hidden>×</span>
          </a>
          {liveDashboard}
        </div>
      )}
    </div>
  );
}
