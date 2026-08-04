'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks';

interface UseDeckStageOptions {
  /** The snapping scroll container - the IntersectionObserver root. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** This card's position in the stream, reported back on every stage change. */
  index: number;
  onPosition: (index: number, stage: number) => void;
}

/**
 * Turns a pinned card's scroll stops into a stage number.
 *
 * Each card lays out N full-height stops behind a sticky shell; whichever stop
 * is crossing the viewport's midline is the active deck. Reading the stage off
 * real scroll position (rather than synthesising gestures) keeps the wheel,
 * touch, keyboard, and the browser's own snapping all working unmodified.
 */
export function useDeckStage({ rootRef, index, onPosition }: UseDeckStageOptions) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;

    const stops = Array.from(card.querySelectorAll<HTMLElement>('[data-stop]'));
    if (stops.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const at = Number((entry.target as HTMLElement).dataset.stop);
          if (!Number.isFinite(at)) continue;
          setStage(at);
          onPosition(index, at);
        }
      },
      // A one-pixel band across the middle: exactly one stop can own it.
      { root, rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );

    stops.forEach((stop) => observer.observe(stop));
    return () => observer.disconnect();
  }, [rootRef, index, onPosition]);

  /** Scroll to the next deck, or to the next card once the last deck is read. */
  const advance = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    const stops = Array.from(card.querySelectorAll<HTMLElement>('[data-stop]'));
    const next = stops[stage + 1];

    if (next) {
      next.scrollIntoView({ block: 'start', behavior });
      return;
    }
    const sibling = card.nextElementSibling;
    sibling?.querySelector<HTMLElement>('[data-stop]')?.scrollIntoView({
      block: 'start',
      behavior,
    });
  }, [stage, reduced]);

  return { cardRef, stage, advance };
}
