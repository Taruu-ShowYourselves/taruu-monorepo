'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './Team.module.css';

interface Member {
  name: string;
  role: string;
  bio: string;
}

interface TeamCopy {
  ariaLabel: string;
  kicker: string;
  headlineStart: string;
  headlineAccent: string;
  sub: string;
  members: Member[];
}

// TODO: placeholder bios - replace with the founders' real roles + bios.
const COPY: Record<Locale, TeamCopy> = {
  he: {
    ariaLabel: 'הצוות',
    kicker: 'הצוות',
    headlineStart: 'האנשים מאחורי',
    headlineAccent: 'תַּרְאוּ.',
    sub: 'צוות קטן מרקע של טכנולוגיה, ממשל מקומי וחוויית משתמש. מטרה אחת: להחזיר את הקול לתושבים.',
    members: [
      {
        name: 'סהר ברק',
        role: 'מייסד',
        bio: 'מוביל את תַּרְאוּ: דמוקרטיה מקומית שקופה, מאומתת ובשליטת התושבים.',
      },
      {
        name: 'עיילה איילון',
        role: 'מייסדת',
        bio: 'מובילה את תַּרְאוּ: מהרעיון של קונצנזוס ציבורי ועד החוויה בפועל לתושב.',
      },
    ],
  },
  en: {
    ariaLabel: 'The team',
    kicker: 'The Team',
    headlineStart: 'The people behind',
    headlineAccent: 'Taruu.',
    sub: 'A small team with backgrounds in technology, local government, and user experience. One goal: returning the voice to the residents.',
    members: [
      {
        name: 'Sahar Barak',
        role: 'Founder',
        bio: 'Leads Taruu: local democracy that is transparent, verified, and in the residents’ hands.',
      },
      {
        name: 'Ayala Ayalon',
        role: 'Founder',
        bio: 'Leads Taruu: from the idea of public consensus to the resident’s actual experience.',
      },
    ],
  },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
}

interface TeamProps {
  locale?: Locale;
}

export function Team({ locale = 'he' }: TeamProps) {
  const reducedMotion = useReducedMotion();
  const t = COPY[locale];

  return (
    <section className={styles.team} aria-label={t.ariaLabel}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 className={styles.headline}>
            {t.headlineStart} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
          <p className={styles.sub}>{t.sub}</p>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <ul className={styles.grid}>
          {t.members.map((member, i) => (
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
