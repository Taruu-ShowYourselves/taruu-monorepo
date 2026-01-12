'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import styles from './Team.module.css';

const team = [
  {
    name: 'דנה כהן',
    role: 'מייסדת ומנכ״לית',
    bio: 'יזמית טכנולוגיה עם רקע בממשל מקומי. מאמינה שהטכנולוגיה יכולה לשנות את הדרך שבה אזרחים משתתפים בקהילה.',
  },
  {
    name: 'יוסי לוי',
    role: 'מנהל טכנולוגיות',
    bio: 'מומחה בלוקצ׳יין ואבטחת מידע. הוביל פרויקטים גלובליים בחברות טכנולוגיה מובילות.',
  },
  {
    name: 'מיכל אברהם',
    role: 'מנהלת מוצר',
    bio: 'עשר שנות ניסיון בפיתוח מוצרים דיגיטליים. מתמחה בחוויית משתמש ונגישות.',
  },
  {
    name: 'אורי שמעוני',
    role: 'מנהל פיתוח עסקי',
    bio: 'רקע בעבודה עם רשויות מקומיות וממשלה. מגשר בין הטכנולוגיה לצרכי הקהילה.',
  },
];

export function Team() {
  return (
    <section className={styles.team}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              הצוות
            </Text>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center">
              <AnimatedWords text="האנשים מאחורי תַּרְאוּ" delay={0.2} />
            </Heading>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.2}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              צוות מגוון של מומחים בטכנולוגיה, ממשל מקומי וחוויית משתמש,
              מאוחדים תחת חזון משותף.
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Team Grid */}
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
          {team.map((member) => (
            <motion.div
              key={member.name}
              className={styles.memberCard}
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
              whileHover={{ y: -4 }}
            >
              <div className={styles.avatar}>
                {member.name.charAt(0)}
              </div>
              <h3 className={styles.memberName}>{member.name}</h3>
              <Text size="sm" color="accent" weight="medium">
                {member.role}
              </Text>
              <Text size="sm" color="secondary" className={styles.memberBio}>
                {member.bio}
              </Text>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
