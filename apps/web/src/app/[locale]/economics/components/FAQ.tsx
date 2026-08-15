'use client';

import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './FAQ.module.css';

interface FAQCopy {
  kicker: string;
  headlineLead: string;
  headlineAccent: string;
  standfirst: string;
  faqs: { question: string; answer: string }[];
}

const HE_FAQS = [
  {
    question: 'למה לא פשוט לתרום ישירות?',
    answer:
      'כי כל הצבעה מקבלת BAG משלה ב-bags.fm, וה-BAG יוצר שוק. אתה לא רק תורם, אלא מחזיק נכס שמייצג את התמיכה שלך, בדיוק כמו במניה. אם יותר אנשים משקיעים, ה-BAG שווה יותר. זה יוצר תמריץ לשתף ולהפיץ את הנושא.',
  },
  {
    question: 'מה קורה לכסף?',
    answer:
      '70% זורם ישירות לקרן הקהילתית. 30% מממן את הפלטפורמה. הכל שקוף על הבלוקצ\'יין, ואפשר לראות כל עסקה בזמן אמת.',
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
      '30% מעמלות המסחר ומדמי יצירת הצבעות. אנחנו לא תלויים במשקיעים חיצוניים. המודל הכלכלי מתקיים מעצמו מהיום הראשון.',
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

const EN_FAQS = [
  {
    question: 'Why not just donate directly?',
    answer:
      'Because every vote gets its own BAG on bags.fm, and the BAG creates a market. You are not only donating - you hold an asset that represents your support, much like a share. If more people invest, the BAG is worth more. That gives people a reason to share the topic and spread it.',
  },
  {
    question: 'What happens to the money?',
    answer:
      '70% flows straight into the community fund. 30% funds the platform. All of it is transparent on the blockchain, and every transaction can be watched in real time.',
  },
  {
    question: 'Is this crypto?',
    answer:
      'Yes, but you need to know nothing about crypto to use it. Residents vote for free, with no wallet and no coins. The crypto works behind the scenes to guarantee transparency and security.',
  },
  {
    question: 'Why bags.fm specifically?',
    answer:
      'bags.fm gives an independent economic rail that cannot be shut down: the money, the BAGS and the fund run on a public blockchain rather than on one party\'s server that can be leaned on or switched off. Every BAG is transparent and every transaction is auditable. The structure fits what we do: civic economics, community control of community money, and transparency towards authorities and tax.',
  },
  {
    question: 'What if I do not live in Israel?',
    answer:
      "You can support Israeli communities from anywhere in the world by buying the vote's BAG on bags.fm. You need a crypto wallet and a coin to buy with. When the vote ends you receive a \"community supporter\" certificate.",
  },
  {
    question: 'What is the digital certificate and why do I need it?',
    answer:
      'The certificate (an NFT) is a digital record proving you took part in a specific vote. It stays with you, signed on the blockchain.',
  },
  {
    question: 'How does the platform make money?',
    answer:
      '30% of trading fees and of vote-creation fees. We do not depend on outside investors. The economic model sustains itself from day one.',
  },
  {
    question: 'What happens when a vote ends?',
    answer:
      'When a vote ends the vote\'s BAG freezes (it can no longer be traded), the funds move to the community fund, and digital certificates are issued to every participant: "verified voter" for residents and "community supporter" for outside backers.',
  },
  {
    question: 'Is it safe?',
    answer:
      'Yes. We use proven blockchain technology, secured payments through a Merchant of Record, and identity verification via Google, phone number and GPS. All the code is open to audit.',
  },
];

const COPY: Record<Locale, FAQCopy> = {
  he: {
    kicker: 'שאלות נפוצות · FAQ',
    headlineLead: 'כל מה שרציתם לשאול על',
    headlineAccent: 'הכלכלה האזרחית.',
    standfirst: "בלי ז'רגון ובלי אותיות קטנות. תשובות ישירות.",
    faqs: HE_FAQS,
  },
  en: {
    kicker: 'FREQUENTLY ASKED · FAQ',
    headlineLead: 'Everything you wanted to ask about',
    headlineAccent: 'civic economics.',
    standfirst: 'No jargon and no small print. Straight answers.',
    faqs: EN_FAQS,
  },
};

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

export function FAQ({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const reduced = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className={styles.faq} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="faq-title" className={styles.headline}>
            {t.headlineLead} <span className={styles.red}>{t.headlineAccent}</span>
          </h2>
          <p className={styles.standfirst}>{t.standfirst}</p>
        </header>

        <div className={styles.faqList}>
          {t.faqs.map((faq, index) => (
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
