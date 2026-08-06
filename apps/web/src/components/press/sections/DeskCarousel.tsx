'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll, { type AutoScrollType } from 'embla-carousel-auto-scroll';
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

/**
 * DeskCarousel - RTL swipe carousel for topic cards (Embla under the hood:
 * drag momentum, snap, native RTL). Sways continuously via the official
 * auto-scroll plugin - pauses on hover, resumes after interaction; off
 * entirely under prefers-reduced-motion. Press-square arrows for manual
 * paging.
 */
export function DeskCarousel({ children, label, locale = 'he' }: DeskCarouselProps) {
  const t = COPY[locale];
  // Computed once - plugin config doesn't affect SSR markup, so the
  // server/client difference is hydration-safe.
  const [autoScroll] = useState<AutoScrollType | null>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return null;
    }
    return AutoScroll({ speed: 0.6, startDelay: 800, stopOnInteraction: false });
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      direction: 'rtl',
      align: 'start',
      loop: true,
      skipSnaps: true,
      // Below the bento breakpoint the track is a static vertical mosaic -
      // Embla (and with it the auto-scroll drift) stands down entirely.
      breakpoints: { '(max-width: 800px)': { active: false } },
    },
    autoScroll ? [autoScroll] : []
  );
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
        onMouseEnter={() => autoScroll?.stop()}
        onMouseLeave={() => autoScroll?.play()}
      >
        <ol className={styles.track}>{children}</ol>
      </div>

      {(canPrev || canNext) && (
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            aria-label={t.prevLabel}
          >
            {t.prevGlyph}
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => emblaApi?.scrollNext()}
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
