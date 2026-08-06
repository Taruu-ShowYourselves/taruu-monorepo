'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { DeskDrift, type DeskDriftType } from './deskDrift';
import type { Locale } from '@/lib/i18n';
import styles from './DeskCarousel.module.css';

interface CarouselCopy {
  prevLabel: string;
  nextLabel: string;
  /** Paging glyphs are direction-semantic: mirrored between RTL and LTR. */
  prevGlyph: string;
  nextGlyph: string;
}

const COPY: Record<Locale, CarouselCopy> = {
  he: { prevLabel: 'הקודם', nextLabel: 'הבא', prevGlyph: '→', nextGlyph: '←' },
  en: { prevLabel: 'Previous', nextLabel: 'Next', prevGlyph: '←', nextGlyph: '→' },
};

interface DeskCarouselProps {
  children: React.ReactNode;
  /** Announced label for the carousel region. */
  label: string;
  locale?: Locale;
}

/** Drift speed with nobody reading, and the pace it eases to under a cursor. */
const DRIFT_SPEED = 0.6;
const HOVER_SPEED = 0.12;

const EMBLA_OPTIONS = {
  direction: 'rtl' as const,
  align: 'start' as const,
  loop: true,
  skipSnaps: true,
  // Below the bento breakpoint the track is a static vertical mosaic -
  // Embla (and with it the auto-scroll drift) stands down entirely.
  breakpoints: { '(max-width: 800px)': { active: false } },
};

/**
 * DeskCarousel - RTL swipe carousel for topic cards (Embla under the hood:
 * drag momentum, snap, native RTL). Sways continuously; a cursor on the desk
 * eases the sway down to a reading pace rather than halting it, so the tiles
 * never look frozen. Off entirely under prefers-reduced-motion. Press-square
 * arrows for manual paging.
 */
export function DeskCarousel({ children, label, locale = 'he' }: DeskCarouselProps) {
  const t = COPY[locale];
  // Computed once - plugin config doesn't affect SSR markup, so the
  // server/client difference is hydration-safe.
  /* One instance for the life of the carousel: re-initialising Embla to change
     pace snaps the track to its nearest slide, which reads as the desk jumping
     backwards the moment a cursor arrives. `DeskDrift` takes its new speed
     live instead. */
  const [drift] = useState<DeskDriftType | null>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return null;
    }
    return DeskDrift({ speed: DRIFT_SPEED, startDelay: 800 });
  });
  const plugins = useMemo(() => (drift ? [drift] : []), [drift]);

  const [emblaRef, emblaApi] = useEmblaCarousel(EMBLA_OPTIONS, plugins);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const refresh = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    refresh();
    emblaApi.on('select', refresh);
    emblaApi.on('reInit', refresh);
    return () => {
      emblaApi.off('select', refresh);
      emblaApi.off('reInit', refresh);
    };
  }, [emblaApi, refresh]);

  return (
    <div className={styles.carousel} role="region" aria-label={label}>
      <div
        className={styles.viewport}
        ref={emblaRef}
        onMouseEnter={() => drift?.setSpeed(HOVER_SPEED)}
        onMouseLeave={() => drift?.setSpeed(DRIFT_SPEED)}
      >
        <ol className={styles.track}>{children}</ol>
      </div>

      {(canPrev || canNext) && (
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => {
              drift?.pageOver();
              emblaApi?.scrollPrev();
            }}
            disabled={!canPrev}
            aria-label={t.prevLabel}
          >
            {t.prevGlyph}
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => {
              drift?.pageOver();
              emblaApi?.scrollNext();
            }}
            disabled={!canNext}
            aria-label={t.nextLabel}
          >
            {t.nextGlyph}
          </button>
        </div>
      )}
    </div>
  );
}
