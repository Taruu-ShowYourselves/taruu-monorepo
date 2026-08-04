'use client';

import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './FAQ.module.css';

const faqs = [
  // COIN-04 owns this answer's investment wording; it is gated on COIN-01's written legal sign-off and is left verbatim on purpose.
  {
    question: 'למה לא פשוט לתרום ישירות?',
    answer:
      'כי כל הצבעה מקבלת BAG משלה ב-bags.fm, וה-BAG יוצר שוק. אתה לא רק תורם, אלא מחזיק נכס שמייצג את התמיכה שלך, בדיוק כמו במניה. אם יותר אנשים משקיעים, ה-BAG שווה יותר. זה יוצר תמריץ לשתף ולהפיץ את הנושא.',
  },
  {
    question: 'מה קורה לכסף?',
    answer:
      'ההשתתפות בהצבעות חינם. יצירת הצבעה חדשה עולה ₪50, שמממנים את תפעול הפלטפורמה. הקרן הקהילתית מתמלאת מהשקעות חיצוניות ב-BAG של כל הצבעה, לא מכסף של תושבים, וכל תנועה שלה גלויה.',
  },
  {
    question: 'האם זה קריפטו?',
    answer:
      'כן, אבל אתה לא צריך לדעת כלום על קריפטו כדי להשתמש. תושבים מצביעים חינם, בלי ארנק ובלי מטבעות. הקריפטו עובד מאחורי הקלעים כדי להבטיח שקיפות ואבטחה.',
  },
  {
    question: 'למה בחרתם דווקא ב-bags.fm?',
    answer:
      'bags.fm נותן מסילה כלכלית עצמאית שאי-אפשר לסגור: הכסף, ה-BAGS והקרן רצים על בלוקצ\'יין ציבורי, ולא על שרת של גורם יחיד שאפשר ללחוץ עליו או לכבות. כל BAG שקוף וכל עסקה ניתנת לבדיקה. המבנה מתאים למה שאנחנו עושים: כלכלה אזרחית, שליטה בכסף הקהילתי ושקיפות מול רשויות ומיסוי.',
  },
  {
    question: 'מה אם אני לא גר בישראל?',
    answer:
      'אפשר לתמוך בקהילות ישראליות מכל מקום בעולם על ידי רכישת ה-BAG של ההצבעה ב-bags.fm. צריך ארנק קריפטו ומטבע לרכישה. כשההצבעה מסתיימת מתקבלת תעודת "תומך קהילתי".',
  },
  {
    question: 'מה זו התעודה הדיגיטלית ולמה אני צריך אותה?',
    answer:
      'התעודה (NFT) היא רשומה דיגיטלית שמוכיחה שהשתתפת בהצבעה ספציפית. היא נשארת איתך, חתומה בבלוקצ\'יין.',
  },
  {
    question: 'איך הפלטפורמה מרוויחה כסף?',
    answer:
      'מדמי יצירת הצבעה: ₪50 על כל הצבעה חדשה. אנחנו לא תלויים במשקיעים חיצוניים. המודל הכלכלי מתקיים מעצמו מהיום הראשון.',
  },
  {
    question: 'מה קורה כשההצבעה מסתיימת?',
    answer:
      'כשהצבעה מסתיימת: ה-BAG של ההצבעה נקפא (אי אפשר לסחור בו יותר), הכספים מועברים לקרן הקהילתית, ותעודות דיגיטליות מונפקות לכל המשתתפים: "מצביע מאומת" לתושבים ו"תומך קהילתי" לתומכים החיצוניים.',
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
            בלי ז&apos;רגון ובלי אותיות קטנות. תשובות ישירות.
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
