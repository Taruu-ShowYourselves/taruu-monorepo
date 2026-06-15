'use client';

import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './FAQ.module.css';

const faqs = [
  {
    question: 'למה לא פשוט לתרום ישירות?',
    answer:
      'כי כל הצבעה מקבלת BAG משלה ב-bags.fm, וה-BAG יוצר שוק. אתה לא רק תורם — אתה מחזיק נכס שמייצג את התמיכה שלך, בדיוק כמו במניה. אם יותר אנשים משקיעים, ה-BAG שווה יותר. זה יוצר תמריץ לשתף ולהפיץ את הנושא.',
  },
  {
    question: 'מה קורה לכסף?',
    answer:
      '70% זורם ישירות לקרן הקהילתית. 30% מממן את הפלטפורמה. הכל שקוף על הבלוקצ\'יין — אפשר לראות כל עסקה בזמן אמת.',
  },
  {
    question: 'האם זה קריפטו?',
    answer:
      'כן, אבל אתה לא צריך לדעת כלום על קריפטו כדי להשתמש. תושבים משלמים בשקלים רגילים דרך כרטיס אשראי. הקריפטו עובד מאחורי הקלעים כדי להבטיח שקיפות ואבטחה.',
  },
  {
    question: 'למה בחרתם דווקא ב-bags.fm?',
    answer:
      'bags.fm נותן מסילה כלכלית עצמאית שאי-אפשר לסגור — הכסף, ה-BAGS והקרן רצים על בלוקצ\'יין ציבורי, ולא על שרת של גורם יחיד שאפשר ללחוץ עליו או לכבות. כל BAG שקוף וכל עסקה ניתנת לבדיקה. המבנה מתאים בדיוק למה שאנחנו עושים: כלכלה אזרחית, שליטה בכסף הקהילתי ושקיפות מול רשויות ומיסוי — בלי שאף אחד יוכל לסגור לנו את הברז.',
  },
  {
    question: 'מה אם אני לא גר בישראל?',
    answer:
      'מצוין! אפשר לתמוך בקהילות ישראליות מכל מקום בעולם על ידי רכישת ה-BAG של ההצבעה ב-bags.fm. צריך ארנק קריפטו ומטבע לרכישה. כשההצבעה מסתיימת — מתקבלת תעודת "תומך קהילתי".',
  },
  {
    question: 'מה זו התעודה הדיגיטלית ולמה אני צריך אותה?',
    answer:
      'התעודה (NFT) היא "תעודת זהות דיגיטלית" שמוכיחה שהשתתפת בהצבעה ספציפית. היא נשארת איתך לתמיד ומראה את המחויבות האזרחית שלך. ערכה יכול לעלות ככל שהפלטפורמה גדלה.',
  },
  {
    question: 'איך הפלטפורמה מרוויחה כסף?',
    answer:
      '30% מעמלות המסחר ומתשלומי ההצבעות. אנחנו לא תלויים במשקיעים חיצוניים — המודל הכלכלי מתקיים מעצמו מהיום הראשון.',
  },
  {
    question: 'מה קורה כשההצבעה מסתיימת?',
    answer:
      'כשהצבעה מסתיימת: ה-BAG של ההצבעה נקפא (אי אפשר לסחור בו יותר), הכספים מועברים לקרן הקהילתית, ותעודות דיגיטליות מונפקות לכל המשתתפים — "מצביע מאומת" לתושבים ו"תומך קהילתי" לתומכים החיצוניים.',
  },
  {
    question: 'האם זה בטוח?',
    answer:
      'כן. אנחנו משתמשים בטכנולוגיית בלוקצ\'יין מוכחת, תשלומים מאובטחים דרך Merchant of Record, ואימות זהות באמצעות Google, מספר טלפון ו-GPS. כל הקוד פתוח לביקורת.',
  },
];

function FAQItem({
  index,
  question,
  answer,
  isOpen,
  onClick,
  reduced,
}: {
  index: number;
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  reduced: boolean;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className={`${styles.faqItem} ${isOpen ? styles.open : ''}`}>
      <button
        id={buttonId}
        className={styles.faqQuestion}
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className={styles.faqNum} aria-hidden>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className={styles.faqText}>{question}</span>
        <span className={styles.faqIcon} aria-hidden>
          {isOpen ? '✕' : '+'}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            className={styles.faqAnswer}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const reduced = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className={styles.faq} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            שאלות נפוצות · FAQ
          </span>
          <h2 id="faq-title" className={styles.headline}>
            כל מה שרציתם לשאול על <span className={styles.red}>הכלכלה האזרחית.</span>
          </h2>
          <p className={styles.standfirst}>
            בלי ז&apos;רגון, בלי אותיות קטנות — התשובות הישירות.
          </p>
        </header>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              index={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              reduced={reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
