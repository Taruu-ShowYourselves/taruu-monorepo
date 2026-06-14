'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { LegalSection } from './LegalPage';
import styles from './LegalPage.module.css';

interface LegalContentProps {
  title: string;
  intro?: string;
  updated?: string;
  sections: LegalSection[];
}

/** Mechanical hard-out ease — editorial, no bounce. */
const NP_EASE = [0.2, 0, 0, 1] as const;

/** Stable, locale-agnostic anchor id for a section. */
function sectionId(index: number): string {
  return `legal-section-${index + 1}`;
}

/**
 * Editorial imprint body for the shared legal layout: a grotesque masthead-style
 * title with mono dateline, a sticky mono section index, and a single serif
 * reading column with ink-ruled numbered sections. All motion is a hard clip
 * reveal that degrades cleanly under reduced-motion.
 */
export function LegalContent({ title, intro, updated, sections }: LegalContentProps) {
  const reducedMotion = useReducedMotion();
  const ids = useMemo(() => sections.map((_, i) => sectionId(i)), [sections]);
  const [activeId, setActiveId] = useState<string>(ids[0] ?? '');

  // Track the section closest to the top of the viewport for index highlighting.
  useEffect(() => {
    if (typeof window === 'undefined' || ids.length === 0) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  const handleJump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    el.focus({ preventScroll: true });
  };

  // Hard clip reveal (inset wipe), not fade-up. Jumps to final under RM.
  const sectionInitial = reducedMotion
    ? { opacity: 1, clipPath: 'inset(0 0 0 0)' }
    : { opacity: 0, clipPath: 'inset(0 0 100% 0)' };
  const sectionAnimate = { opacity: 1, clipPath: 'inset(0 0 0 0)' };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          מסמך משפטי · IMPRINT
        </span>

        <h1 className={styles.title}>{title}</h1>

        <div className={styles.rule} aria-hidden />

        {(intro || updated) && (
          <div className={styles.standfirst}>
            {intro && <p className={styles.intro}>{intro}</p>}
            {updated && (
              <p className={styles.updated}>
                <span aria-hidden className={styles.updatedTick} />
                {updated}
              </p>
            )}
          </div>
        )}
      </header>

      <div className={styles.body}>
        {sections.length > 1 && (
          <nav className={styles.toc} aria-label="ניווט בסעיפים">
            <span className={styles.tocLabel}>בעמוד זה · INDEX</span>
            <ol className={styles.tocList}>
              {sections.map((section, i) => {
                const id = ids[i];
                const isActive = id === activeId;
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => handleJump(e, id)}
                      className={styles.tocLink}
                      aria-current={isActive ? 'true' : undefined}
                      data-active={isActive || undefined}
                    >
                      <span className={styles.tocNum} aria-hidden>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.tocText}>{section.heading}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <article className={styles.panel}>
          {sections.map((section, i) => {
            const id = ids[i];
            return (
              <motion.section
                key={id}
                id={id}
                tabIndex={-1}
                className={styles.section}
                aria-labelledby={`${id}-heading`}
                initial={sectionInitial}
                whileInView={sectionAnimate}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: reducedMotion ? 0 : 0.32, ease: NP_EASE }}
              >
                <h2 id={`${id}-heading`} className={styles.heading}>
                  {section.heading}
                </h2>

                {section.paragraphs?.map((p, j) => (
                  <p key={j} className={styles.paragraph}>
                    {p}
                  </p>
                ))}

                {section.bullets && (
                  <ul className={styles.bullets}>
                    {section.bullets.map((b, k) => (
                      <li key={k} className={styles.bullet}>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            );
          })}
        </article>
      </div>
    </div>
  );
}
