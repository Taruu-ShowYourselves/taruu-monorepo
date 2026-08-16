'use client';

import { useEffect, useRef } from 'react';

/**
 * Arms a section's entrance choreography from inside it.
 *
 * Renders nothing. On mount it stamps the closest <section> with
 * `data-armed` (the stylesheet may now hold things back) and, the first
 * time the section is properly on screen, with `data-seen` (play the
 * entrance). Both attributes only ever exist with JS running, so a page
 * without it simply prints everything - the same contract the live map's
 * inline observer keeps.
 *
 * One shared primitive instead of one observer per component: any server
 * section becomes animatable by dropping <Reveal /> inside it and writing
 * its own [data-armed]/[data-seen] rules.
 */
export function Reveal({ threshold = 0.25 }: { threshold?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = ref.current?.closest('section');
    if (!host) return;
    host.setAttribute('data-armed', '');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        host.setAttribute('data-seen', '');
      },
      { threshold }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [threshold]);

  return <span ref={ref} hidden />;
}
