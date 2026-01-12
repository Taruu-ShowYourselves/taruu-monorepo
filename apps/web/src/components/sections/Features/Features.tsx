'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Typography';
import styles from './Features.module.css';

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
    title: 'נושאים מקומיים אמיתיים',
    description: 'מה שמעסיק את הרחוב, לא רק מה שעל סדר היום.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'תושבים מאומתים',
    description: 'רק מי שנמצא בתוך הרשות משתתף בנושאים שלה.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M2 12h4M18 12h4" />
      </svg>
    ),
    title: 'תוצאות שקופות',
    description: 'רואים את התמונה בזמן אמת, בלי "חדרים סגורים".',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8M8 13h4" />
      </svg>
    ),
    title: 'דיון קהילתי קצר וברור',
    description: 'פחות רעש, יותר בהירות.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'קרן קהילה לפעולה',
    description: 'דמי השתתפות שנשמרים לטובת צעדים כשצריך.',
  },
];

// Duplicate for seamless loop
const duplicatedFeatures = [...features, ...features];

export function Features() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = index > 0 ? index - 1 : duplicatedFeatures.length - 1;
        const cards = marqueeRef.current?.querySelectorAll('[data-card]');
        (cards?.[nextIndex] as HTMLElement)?.focus();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextIndex = index < duplicatedFeatures.length - 1 ? index + 1 : 0;
        const cards = marqueeRef.current?.querySelectorAll('[data-card]');
        (cards?.[nextIndex] as HTMLElement)?.focus();
      }
    },
    []
  );

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null || !trackRef.current) return;
    const diff = touchStart - e.touches[0].clientX;
    const newPos = scrollPosition + diff;
    trackRef.current.style.transform = `translateX(${-newPos}px)`;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !trackRef.current) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    setScrollPosition((prev) => prev + diff);
    setTouchStart(null);
    // Resume auto-scroll after a delay on mobile
    setTimeout(() => setIsPaused(false), 3000);
  };

  return (
    <section className={styles.features} aria-label="יתרונות הפלטפורמה">
      <div
        ref={marqueeRef}
        className={styles.marquee}
        onMouseEnter={() => !isMobile && setIsPaused(true)}
        onMouseLeave={() => !isMobile && setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={trackRef}
          className={styles.track}
          style={{
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
          aria-live="off"
        >
          {duplicatedFeatures.map((feature, index) => (
            <Card
              key={`${feature.title}-${index}`}
              variant="elevated"
              padding="lg"
              className={styles.card}
            >
              <CardContent>
                <div
                  data-card
                  tabIndex={0}
                  role="article"
                  aria-label={feature.title}
                  className={styles.cardInner}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  <div className={styles.iconWrapper}>{feature.icon}</div>
                  <h3 className={styles.cardTitle}>{feature.title}</h3>
                  <Text size="base" color="secondary">
                    {feature.description}
                  </Text>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* Visually hidden instructions for screen readers */}
      <div className={styles.srOnly}>
        השתמשו במקשי החיצים כדי לנווט בין הכרטיסים. לחצו Enter או רווח כדי להשהות את הגלילה.
      </div>
    </section>
  );
}
