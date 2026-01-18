'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './FAQ.module.css';

const faqs = [
  {
    question: 'למה לא פשוט לתרום ישירות?',
    answer:
      'כי Issue Coins יוצרים שוק. אתה לא רק תורם - אתה מחזיק נכס שמייצג את התמיכה שלך. אם יותר אנשים תומכים, הנכס שלך שווה יותר. זה יוצר תמריץ לשתף ולהפיץ את הנושא.',
  },
  {
    question: 'מה קורה לכסף?',
    answer:
      '70% הולך ישירות לקרן העירונית. 30% מממן את הפלטפורמה. הכל שקוף על הבלוקצ\'יין - אפשר לראות כל עסקה בזמן אמת.',
  },
  {
    question: 'האם זה קריפטו?',
    answer:
      'כן, אבל אתה לא צריך לדעת כלום על קריפטו כדי להשתמש. ישראלים משלמים בשקלים רגילים דרך כרטיס אשראי. הקריפטו עובד מאחורי הקלעים כדי להבטיח שקיפות ואבטחה.',
  },
  {
    question: 'מה אם אני לא גר בישראל?',
    answer:
      'מצוין! אתה יכול לתמוך בקהילות ישראליות מכל מקום בעולם דרך Issue Coins. תצטרך ארנק Solana (כמו Phantom) ו-SOL לרכישה. כשההצבעה מסתיימת, תקבל NFT של "Civic Patron".',
  },
  {
    question: 'מה זה NFT ולמה אני צריך את זה?',
    answer:
      'NFT הוא "תעודת זהות דיגיטלית" שמוכיחה שהשתתפת בהצבעה ספציפית. הוא נשאר איתך לתמיד ומראה את המחויבות האזרחית שלך. NFTs יכולים להיות בעלי ערך ככל שהפלטפורמה גדלה.',
  },
  {
    question: 'איך הפלטפורמה מרוויחה כסף?',
    answer:
      '30% מעמלות המסחר ומתשלומי ההצבעות. אנחנו לא תלויים במשקיעים חיצוניים - המודל הכלכלי מתקיים מעצמו מהיום הראשון.',
  },
  {
    question: 'מה קורה כשההצבעה מסתיימת?',
    answer:
      'כשהצבעה מסתיימת: 1) ה-Issue Coin נקפא (אי אפשר לסחור יותר), 2) הכספים מועברים לקופת הרשות, 3) NFTs מונפקים לכל המשתתפים - "מצביע מאומת" לתושבים ו-"Civic Patron" לתומכים חיצוניים.',
  },
  {
    question: 'האם זה בטוח?',
    answer:
      'כן. אנחנו משתמשים בטכנולוגיית בלוקצ\'יין מוכחת (Solana), תשלומים דרך ספק ישראלי מורשה (Green Invoice), ואימות זהות באמצעות Google OAuth ו-GPS. כל הקוד פתוח לביקורת.',
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`${styles.faqItem} ${isOpen ? styles.open : ''}`}>
      <button className={styles.faqQuestion} onClick={onClick}>
        <span>{question}</span>
        <span className={styles.faqIcon}>{isOpen ? '−' : '+'}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.faqAnswer}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className={styles.faq}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.title}>שאלות נפוצות</h2>
          <p className={styles.subtitle}>
            תשובות לשאלות הכי נפוצות על הכלכלה של תַּרְאוּ
          </p>
        </motion.div>

        <motion.div
          className={styles.faqList}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
