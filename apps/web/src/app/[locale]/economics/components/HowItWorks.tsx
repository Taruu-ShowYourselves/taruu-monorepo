'use client';

import { motion } from 'framer-motion';
import styles from './HowItWorks.module.css';

const residentSteps = [
  {
    number: '1',
    title: 'אמת את הזהות שלך',
    description: 'התחבר עם Google ואמת מיקום עם GPS',
    icon: '🔐',
  },
  {
    number: '2',
    title: 'צפה בהצבעות פעילות',
    description: 'גלה נושאים בעיר שלך שדורשים הכרעה',
    icon: '👀',
  },
  {
    number: '3',
    title: 'שלם ₪3 והצבע',
    description: 'בחר את האפשרות שאתה מעדיף',
    icon: '🗳️',
  },
  {
    number: '4',
    title: 'קבל NFT של "מצביע מאומת"',
    description: 'הוכחה דיגיטלית להשתתפות שלך',
    icon: '🏆',
  },
  {
    number: '5',
    title: 'צפה בכסף שנאסף',
    description: 'עקוב אחרי הגדלת הקרן העירונית',
    icon: '📊',
  },
];

const supporterSteps = [
  {
    number: '1',
    title: 'Connect Solana Wallet',
    description: 'Use Phantom, Solflare, or any Solana wallet',
    icon: '🔗',
  },
  {
    number: '2',
    title: 'Browse Trending Issues',
    description: 'Explore civic causes that matter to you',
    icon: '🌐',
  },
  {
    number: '3',
    title: 'Buy Issue Coins',
    description: 'Support causes you believe in with SOL',
    icon: '💎',
  },
  {
    number: '4',
    title: 'Trade as Sentiment Changes',
    description: 'Issue Coins reflect community support',
    icon: '📈',
  },
  {
    number: '5',
    title: 'Receive "Civic Patron" NFT',
    description: 'Get your badge when the vote resolves',
    icon: '🎖️',
  },
];

export function HowItWorks() {
  return (
    <section className={styles.howItWorks}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.title}>איך זה עובד</h2>
          <p className={styles.subtitle}>
            שני מסלולים להשתתפות - כתושב מקומי או כתומך חיצוני
          </p>
        </motion.div>

        <div className={styles.tracksContainer}>
          {/* Resident Track */}
          <motion.div
            className={styles.track}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className={styles.trackHeader}>
              <span className={styles.trackIcon}>🏠</span>
              <h3 className={styles.trackTitle}>לתושבים</h3>
              <span className={styles.trackBadge}>מצביעים מאומתים</span>
            </div>

            <div className={styles.stepsList}>
              {residentSteps.map((step, index) => (
                <motion.div
                  key={step.number}
                  className={styles.stepItem}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                >
                  <div className={styles.stepIcon}>{step.icon}</div>
                  <div className={styles.stepContent}>
                    <span className={styles.stepNumber}>{step.number}</span>
                    <h4 className={styles.stepTitle}>{step.title}</h4>
                    <p className={styles.stepDescription}>{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Supporter Track */}
          <motion.div
            className={styles.track}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className={`${styles.trackHeader} ${styles.supporter}`}>
              <span className={styles.trackIcon}>🌍</span>
              <h3 className={styles.trackTitle}>For Supporters</h3>
              <span className={styles.trackBadge}>External Backers</span>
            </div>

            <div className={styles.stepsList}>
              {supporterSteps.map((step, index) => (
                <motion.div
                  key={step.number}
                  className={styles.stepItem}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                >
                  <div className={styles.stepIcon}>{step.icon}</div>
                  <div className={styles.stepContent}>
                    <span className={styles.stepNumber}>{step.number}</span>
                    <h4 className={styles.stepTitle}>{step.title}</h4>
                    <p className={styles.stepDescription}>{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Fee Allocation Note */}
        <motion.div
          className={styles.feeNote}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <span className={styles.feeNoteIcon}>💰</span>
          <div className={styles.feeNoteContent}>
            <strong>70% מכל עמלות המסחר הולכים לקופת הרשות המקומית</strong>
            <span className={styles.feeNoteSub}>
              30% מממנים את התחזוקה והפיתוח של הפלטפורמה
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
