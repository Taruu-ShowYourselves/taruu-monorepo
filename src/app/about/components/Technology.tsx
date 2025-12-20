'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import styles from './Technology.module.css';

const technologies = [
  {
    name: 'Qubik Blockchain',
    description: 'בלוקצ׳יין מתקדם לרישום הצבעות בלתי הפיך ושקוף',
    color: 'primary',
  },
  {
    name: 'Clerk Authentication',
    description: 'מערכת אימות משתמשים מאובטחת ומתקדמת',
    color: 'secondary',
  },
  {
    name: 'Social Signature',
    description: 'אלגוריתם ייחודי לאימות זהות חברתית',
    color: 'accent',
  },
  {
    name: 'GPS Verification',
    description: 'אימות מיקום בזמן אמת לוודא שייכות לרשות',
    color: 'primary',
  },
  {
    name: 'Green Invoice',
    description: 'עיבוד תשלומים מאובטח ותואם PCI',
    color: 'secondary',
  },
  {
    name: 'Converge Database',
    description: 'מסד נתונים מבוזר ומאובטח',
    color: 'accent',
  },
];

export function Technology() {
  return (
    <section className={styles.technology}>
      <div className={styles.container}>
        {/* Background */}
        <div className={styles.backgroundPattern} />

        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <AnimatedFadeInUp>
              <Text size="lg" color="inverse" weight="semibold" align="center">
                הטכנולוגיה
              </Text>
            </AnimatedFadeInUp>

            <AnimatedFadeInUp delay={0.1}>
              <Heading level={2} color="inverse" align="center">
                <AnimatedWords text="בנויים על הטכנולוגיה המתקדמת ביותר" delay={0.2} />
              </Heading>
            </AnimatedFadeInUp>

            <AnimatedFadeInUp delay={0.2}>
              <Text size="xl" color="muted" align="center" className={styles.description}>
                שילוב של טכנולוגיות מובילות מבטיח חוויה מאובטחת, שקופה ונגישה לכל אזרח.
              </Text>
            </AnimatedFadeInUp>
          </div>

          {/* Technologies Grid */}
          <motion.div
            className={styles.grid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            {technologies.map((tech) => (
              <motion.div
                key={tech.name}
                className={styles.techCard}
                variants={{
                  hidden: { opacity: 0, scale: 0.9 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: {
                      duration: 0.5,
                      ease: [0.25, 0.1, 0.25, 1],
                    },
                  },
                }}
              >
                <div className={`${styles.techIndicator} ${styles[tech.color]}`} />
                <h3 className={styles.techName}>{tech.name}</h3>
                <Text size="sm" color="muted">
                  {tech.description}
                </Text>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
