'use client';

import { ReactNode, useEffect, useRef } from 'react';
import Lenis from '@studio-freight/lenis';

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    // The handle has to be captured and cancelled. Without it the callback
    // re-queues itself forever and survives `destroy()`, so every remount
    // leaves an orphaned loop driving a dead instance - and because
    // `reactStrictMode` double-invokes effects, development ran two of them
    // from the first mount onward.
    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }

    frame = requestAnimationFrame(raf);

    // Handle resize
    const handleResize = () => {
      lenis.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <>{children}</>;
}
