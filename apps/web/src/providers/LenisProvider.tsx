'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Lenis from '@studio-freight/lenis';

interface LenisProviderProps {
  children: ReactNode;
}

/**
 * The page's smooth-scroll engine, published so overlays can silence it.
 *
 * Lenis drives the window itself off wheel and touch events, which means the
 * body-overflow lock every modal library applies does nothing to it: the sheet
 * opens and the page keeps gliding underneath. Handing the instance out is the
 * only way for a dialog to hold the scroll until it closes.
 */
const LenisContext = createContext<Lenis | null>(null);

export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const instance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = instance;
    setLenis(instance);

    // The handle has to be captured and cancelled. Without it the callback
    // re-queues itself forever and survives `destroy()`, so every remount
    // leaves an orphaned loop driving a dead instance - and because
    // `reactStrictMode` double-invokes effects, development ran two of them
    // from the first mount onward.
    let frame = 0;
    function raf(time: number) {
      instance.raf(time);
      frame = requestAnimationFrame(raf);
    }

    frame = requestAnimationFrame(raf);

    // Handle resize
    const handleResize = () => {
      instance.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      instance.destroy();
      window.removeEventListener('resize', handleResize);
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
