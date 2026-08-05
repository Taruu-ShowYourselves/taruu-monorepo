'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './ExploreRail.module.css';

export interface RailItem {
  /** DOM id of the target section (no leading #). */
  id: string;
  label: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * S1 rail - the page's standing index. In-flow it is flat paper over an ink
 * rule; once it pins (sticky) it becomes floating chrome and takes the glass
 * recipe (M4: backdrop-filter + shadow fade, CSS-only, 200ms). Scrollspy
 * underlines the active chip; on mobile the strip scrolls horizontally.
 */
export function ExploreRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');
  const [pinned, setPinned] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Pin detection - a zero-height sentinel right above the sticky rail:
  // when it leaves the viewport upward, the rail is pinned.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  // Scrollspy - the section crossing the upper-third band wins.
  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-25% 0px -65% 0px' }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const scrollTo = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <nav
        className={clsx(styles.rail, pinned && styles.pinned)}
        aria-label="מפתח מדורי העמוד"
      >
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <a
                href={`#${item.id}`}
                onClick={scrollTo(item.id)}
                className={clsx(styles.chip, active === item.id && styles.chipActive)}
                aria-current={active === item.id ? 'true' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
