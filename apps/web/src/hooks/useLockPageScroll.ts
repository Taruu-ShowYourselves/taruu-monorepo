'use client';

import { useEffect } from 'react';
import { useLenis } from '@/providers/LenisProvider';

/**
 * Hold the page still while an overlay is open.
 *
 * A modal library's body-overflow lock only stops the browser's own scrolling.
 * Lenis scrolls the window itself from wheel and touch events, so without this
 * the page glides along behind an open sheet and the reader loses their place
 * on the desk. Stopping the engine hands every scroll event to whatever is on
 * top until it closes.
 *
 * Safe to nest: the last overlay to unmount restarts the engine, and a start
 * on an already-running instance is a no-op.
 */
export function useLockPageScroll(locked: boolean): void {
  const lenis = useLenis();

  useEffect(() => {
    if (!locked || !lenis) return;
    lenis.stop();
    return () => {
      lenis.start();
    };
  }, [locked, lenis]);
}
