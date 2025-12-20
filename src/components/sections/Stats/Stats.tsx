'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import styles from './Stats.module.css';

const stats = [
  {
    value: 12500,
    suffix: '+',
    label: 'אזרחים פעילים',
    description: 'משתמשים שהצביעו לפחות פעם אחת',
  },
  {
    value: 89,
    suffix: '',
    label: 'רשויות מקומיות',
    description: 'מחוברות לפלטפורמה',
  },
  {
    value: 456,
    suffix: '',
    label: 'הצבעות שהושלמו',
    description: 'החלטות שהתקבלו על ידי הקהילה',
  },
  {
    value: 98.7,
    suffix: '%',
    label: 'שביעות רצון',
    description: 'מהמשתמשים ממליצים לחבריהם',
  },
];

function AnimatedNumber({
  value,
  suffix,
  inView,
}: {
  value: number;
  suffix: string;
  inView: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current * 10) / 10);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, inView]);

  const formattedValue =
    value % 1 === 0
      ? displayValue.toLocaleString('he-IL', { maximumFractionDigits: 0 })
      : displayValue.toLocaleString('he-IL', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });

  return (
    <span>
      {formattedValue}
      {suffix}
    </span>
  );
}

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className={styles.stats}>
      {/* Background Typography */}
      <div className={styles.backgroundText}>נתונים</div>

      <div className={styles.container} ref={ref}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="inverse" weight="semibold" align="center">
              בנתונים
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} color="inverse" align="center">
              סינק במספרים
            </Heading>
          </AnimatedFadeInUp>
        </div>

        {/* Stats Grid */}
        <motion.div
          className={styles.grid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.5,
                    ease: [0.25, 0.1, 0.25, 1],
                  },
                },
              }}
            >
              <div className={styles.statValue}>
                <AnimatedNumber
                  value={stat.value}
                  suffix={stat.suffix}
                  inView={isInView}
                />
              </div>
              <div className={styles.statLabel}>{stat.label}</div>
              <Text size="sm" color="muted" align="center">
                {stat.description}
              </Text>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
