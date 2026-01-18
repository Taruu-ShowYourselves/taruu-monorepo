'use client';

import { motion } from 'framer-motion';
import styles from './FlywheelDiagram.module.css';

const flywheelSteps = [
  {
    id: 'local',
    title: 'תושב מקומי',
    description: 'משלם ₪3 להצבעה',
    icon: '👤',
    color: 'primary',
  },
  {
    id: 'coin',
    title: 'Issue Coin נוצר',
    description: 'הצבעה נרשמת בבלוקצ\'יין',
    icon: '🪙',
    color: 'secondary',
  },
  {
    id: 'external',
    title: 'תומך חיצוני',
    description: 'רואה נושא מעניין',
    icon: '🌍',
    color: 'accent',
  },
  {
    id: 'trade',
    title: 'קונה Issue Coins',
    description: 'בSOL, עמלות מיוצרות',
    icon: '📈',
    color: 'secondary',
  },
  {
    id: 'fees',
    title: 'עמלות מחולקות',
    description: '70% לרשות, 30% לפלטפורמה',
    icon: '💰',
    color: 'primary',
  },
  {
    id: 'result',
    title: 'תוצאה נקבעת',
    description: 'NFT מונפק לכל המשתתפים',
    icon: '🏆',
    color: 'accent',
  },
];

const revenueStreams = [
  {
    stream: 'יצירת הצבעה',
    source: '₪50 להצבעה חדשה',
    allocation: 'תפעול הפלטפורמה',
  },
  {
    stream: 'השתתפות בהצבעה',
    source: '₪3 לכל הצבעה',
    allocation: '70% לרשות, 30% לפלטפורמה',
  },
  {
    stream: 'עמלות מסחר',
    source: '1% על כל עסקה',
    allocation: '70% לרשות, 30% לפלטפורמה',
  },
  {
    stream: 'רכישות חיצוניות',
    source: 'SOL → Issue Coins',
    allocation: '100% לקופת הרשות',
  },
];

export function FlywheelDiagram() {
  return (
    <section className={styles.flywheel}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.title}>גלגל התנופה של תַּרְאוּ</h2>
          <p className={styles.subtitle}>
            כל הצבעה מפעילה מחזור כלכלי שמכפיל את ההשפעה
          </p>
        </motion.div>

        {/* Flywheel Steps */}
        <div className={styles.stepsGrid}>
          {flywheelSteps.map((step, index) => (
            <motion.div
              key={step.id}
              className={`${styles.step} ${styles[step.color]}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
            >
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepIcon}>{step.icon}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
              {index < flywheelSteps.length - 1 && (
                <div className={styles.arrow}>→</div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Result Highlight */}
        <motion.div
          className={styles.resultHighlight}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <span className={styles.resultLabel}>תוצאה:</span>
          <span className={styles.resultValue}>
            הצבעה של ₪3 יכולה לייצר ₪300+ בתמיכה
          </span>
        </motion.div>

        {/* Revenue Streams */}
        <motion.div
          className={styles.revenueSection}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h3 className={styles.sectionTitle}>זרמי הכנסה</h3>
          <div className={styles.revenueTable}>
            <div className={styles.tableHeader}>
              <span>זרם</span>
              <span>מקור</span>
              <span>הקצאה</span>
            </div>
            {revenueStreams.map((item, index) => (
              <motion.div
                key={item.stream}
                className={styles.tableRow}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
              >
                <span className={styles.rowStream}>{item.stream}</span>
                <span className={styles.rowSource}>{item.source}</span>
                <span className={styles.rowAllocation}>{item.allocation}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Sustainability Note */}
        <motion.div
          className={styles.sustainabilityNote}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <h4 className={styles.noteTitle}>🌱 ללא תלות במשקיעים</h4>
          <ul className={styles.noteList}>
            <li>הפלטפורמה מתקיימת מיום 1</li>
            <li>הרשויות מרוויחות, לא מוציאות</li>
            <li>המשתמשים מצביעים וגם מרוויחים (NFTs בעלי ערך)</li>
            <li>תומכים חיצוניים מקבלים נכסים סחירים</li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
