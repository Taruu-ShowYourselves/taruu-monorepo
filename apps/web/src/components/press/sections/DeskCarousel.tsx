'use client';

import { Children, cloneElement, isValidElement, useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import styles from './DeskCarousel.module.css';

interface DeskCarouselProps {
  children: React.ReactNode;
  /** Announced label for the carousel region. */
  label: string;
}

/**
 * DeskCarousel — RTL swipe carousel for topic cards (Embla under the hood:
 * drag momentum, snap, native RTL). Sways continuously via the official
 * auto-scroll plugin — pauses on hover, resumes after interaction; off
 * entirely under prefers-reduced-motion. Press-square arrows for manual
 * paging.
 */
export function DeskCarousel({ children, label }: DeskCarouselProps) {
  // Computed once — plugin config doesn't affect SSR markup, so the
  // server/client difference is hydration-safe.
  const [plugins] = useState(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return [];
    }
    return [
      AutoScroll({
        speed: 0.6,
        startDelay: 800,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
      }),
    ];
  });

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      direction: 'rtl',
      align: 'start',
      loop: true,
      skipSnaps: true,
    },
    plugins
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

  // Embla's loop (and with it the continuous sway) needs the track to
  // overflow the viewport. With only a few cards it can't engage — pad the
  // loop with cloned slides so the drift never runs out of runway.
  const items = Children.toArray(children);
  const slides =
    items.length > 0 && items.length < 6
      ? [
          ...items,
          ...items.map((child, i) =>
            isValidElement(child)
              ? cloneElement(child, { key: `loop-dup-${i}` })
              : child
          ),
        ]
      : items;

  return (
    <div className={styles.carousel} role="region" aria-label={label}>
      <div className={styles.viewport} ref={emblaRef}>
        <ol className={styles.track}>{slides}</ol>
      </div>

      {(canPrev || canNext) && (
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            aria-label="הקודם"
          >
            →
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            aria-label="הבא"
          >
            ←
          </button>
        </div>
      )}
    </div>
  );
}
