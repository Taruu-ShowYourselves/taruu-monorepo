'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import styles from './Mission.module.css';

const values = [
  {
    icon: '🎯',
    title: 'שקיפות מלאה',
    description:
      'כל הצבעה נרשמת על הבלוקצ׳יין באופן פומבי ובלתי הפיך. אין מקום להסתרה או מניפולציה.',
  },
  {
    icon: '🔐',
    title: 'אבטחה ללא פשרות',
    description:
      'אימות רב-שכבתי מבטיח שכל הצבעה היא אמיתית ומגיעה מאזרח מאומת.',
  },
  {
    icon: '🤝',
    title: 'נגישות לכולם',
    description:
      'ממשק פשוט ואינטואיטיבי שמאפשר לכל אזרח להשתתף, ללא קשר לרקע טכנולוגי.',
  },
  {
    icon: '💡',
    title: 'חדשנות מתמדת',
    description:
      'אנחנו ממשיכים לפתח ולשפר את הפלטפורמה על בסיס משוב מהקהילה.',
  },
];

export function Mission() {
  return (
    <section className={styles.mission}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Text Content */}
          <div className={styles.textContent}>
            <AnimatedFadeInUp>
              <Text size="lg" color="accent" weight="semibold">
                המשימה שלנו
              </Text>
            </AnimatedFadeInUp>

            <AnimatedFadeInUp delay={0.1}>
              <Heading level={2}>
                <AnimatedWords text="לחזק את הדמוקרטיה המקומית" delay={0.2} />
              </Heading>
            </AnimatedFadeInUp>

            <AnimatedFadeInUp delay={0.2}>
              <Text size="lg" color="secondary" className={styles.missionText}>
                אנחנו מאמינים שההחלטות הכי חשובות הן אלו שמתקבלות ברמה המקומית.
                הרחובות שאנחנו הולכים בהם, הפארקים שהילדים שלנו משחקים בהם,
                השירותים הציבוריים שאנחנו משתמשים בהם - כל אלה מושפעים
                מהחלטות שהתקבלו ברשות המקומית.
              </Text>
            </AnimatedFadeInUp>

            <AnimatedFadeInUp delay={0.3}>
              <Text size="lg" color="secondary">
                סינק נותנת לכם את הכוח להיות חלק מההחלטות האלה. לא פעם בארבע שנים,
                אלא בכל יום. לא דרך נציגים, אלא ישירות. לא באופן אנונימי,
                אלא כאזרחים מאומתים שקולם נשמע.
              </Text>
            </AnimatedFadeInUp>
          </div>

          {/* Values Grid */}
          <motion.div
            className={styles.valuesGrid}
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
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                className={styles.valueCard}
                variants={{
                  hidden: { opacity: 0, y: 20 },
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
                <span className={styles.valueIcon}>{value.icon}</span>
                <h3 className={styles.valueTitle}>{value.title}</h3>
                <Text size="sm" color="secondary">
                  {value.description}
                </Text>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
