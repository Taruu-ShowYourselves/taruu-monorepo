'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './Team.module.css';

interface Member {
  name: string;
  role: string;
  bio: string;
}

const TEAM: Member[] = [
  {
    name: 'דנה כהן',
    role: 'מייסדת ומנכ״לית',
    bio: 'יזמית טכנולוגיה עם רקע בממשל מקומי. מאמינה שהדרך לשנות את הדמוקרטיה מתחילה ברשות אחת.',
  },
  {
    name: 'יוסי לוי',
    role: 'מנהל טכנולוגיות',
    bio: 'מומחה בלוקצ׳יין ואבטחת מידע. בנה מערכות מאומתות שמשרתות מיליוני משתמשים.',
  },
  {
    name: 'מיכל אברהם',
    role: 'מנהלת מוצר',
    bio: 'עשור של פיתוח מוצרים דיגיטליים, עם דגש על חוויית משתמש ונגישות אמיתית לכולם.',
  },
  {
    name: 'אורי שמעוני',
    role: 'פיתוח עסקי',
    bio: 'רקע בעבודה מול רשויות מקומיות וממשלה. מגשר בין הטכנולוגיה לצרכים של הקהילה.',
  },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
}

export function Team() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.team} aria-label="הצוות">
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            הצוות
          </span>
          <h2 className={styles.headline}>
            האנשים מאחורי <span className={styles.red}>תַּרְאוּ.</span>
          </h2>
          <p className={styles.sub}>
            צוות קטן של מומחים בטכנולוגיה, ממשל מקומי וחוויית משתמש — מאוחדים תחת
            חזון אחד: להחזיר את הקול לתושבים.
          </p>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <ul className={styles.grid}>
          {TEAM.map((member, i) => (
            <motion.li
              key={member.name}
              className={styles.member}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.2, 0, 0, 1] }}
            >
              <span className={styles.avatar} aria-hidden="true">
                {getInitials(member.name)}
              </span>
              <span className={styles.memberRole}>{member.role}</span>
              <h3 className={styles.memberName}>{member.name}</h3>
              <p className={styles.memberBio}>{member.bio}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
