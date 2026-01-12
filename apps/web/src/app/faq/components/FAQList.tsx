'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import { faqData, type FAQItem } from '../data/faqData';
import styles from './FAQList.module.css';

function FAQAccordionItem({ item, isOpen, onClick }: {
  item: FAQItem;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className={styles.accordionItem}>
      <button
        className={styles.accordionButton}
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
      >
        <span className={styles.question}>{item.question}</span>
        <motion.span
          className={styles.icon}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-answer-${item.id}`}
            className={styles.answerWrapper}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className={styles.answer}>
              <Text size="lg" color="secondary">
                {item.answer}
              </Text>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQList() {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className={styles.faqSection}>
      <div className={styles.container}>
        <div className={styles.accordionList}>
          {faqData.map((item, index) => (
            <AnimatedFadeInUp key={item.id} delay={0.05 * index}>
              <FAQAccordionItem
                item={item}
                isOpen={openId === item.id}
                onClick={() => handleToggle(item.id)}
              />
            </AnimatedFadeInUp>
          ))}
        </div>
      </div>
    </section>
  );
}
