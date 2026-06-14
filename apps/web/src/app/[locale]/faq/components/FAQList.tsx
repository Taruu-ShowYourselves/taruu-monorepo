'use client';

import { useState, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsButton, PressInput, Segmented } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import {
  faqData,
  faqCategories,
  faqCategoryOrder,
  type FAQItem,
  type FAQCategory,
} from '../data/faqData';
import styles from './FAQList.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

type FilterValue = 'all' | FAQCategory;

const SEGMENTS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'הכול' },
  ...faqCategoryOrder.map((c) => ({ value: c, label: faqCategories[c] })),
];

function FAQRow({
  item,
  num,
  isOpen,
  onToggle,
  reduced,
}: {
  item: FAQItem;
  num: string;
  isOpen: boolean;
  onToggle: () => void;
  reduced: boolean;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className={`${styles.row} ${isOpen ? styles.open : ''}`}>
      <button
        id={buttonId}
        className={styles.question}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className={styles.num} aria-hidden>{num}</span>
        <span className={styles.qText}>{item.question}</span>
        <span className={styles.toggle} aria-hidden>{isOpen ? '×' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            className={styles.answerWrap}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <p className={styles.answer}>{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQList() {
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(faqData[0]?.id ?? null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqData.filter((item) => {
      const matchesCategory = filter === 'all' || item.category === filter;
      const matchesQuery =
        q === '' ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [filter, query]);

  return (
    <section className={styles.section} aria-labelledby="faq-list-title">
      <div className={styles.container}>
        <h2 id="faq-list-title" className={styles.srOnly}>
          רשימת שאלות נפוצות
        </h2>

        {/* Control bar: search + category filter */}
        <div className={styles.controls}>
          <PressInput
            label="חיפוש"
            type="search"
            inputMode="search"
            placeholder="חפשו נושא, מילה או שאלה…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.search}
          />
          <div className={styles.filterWrap}>
            <span className={styles.filterLabel}>סינון לפי נושא</span>
            <Segmented
              segments={SEGMENTS}
              value={filter}
              onChange={setFilter}
              variant="red"
              aria-label="סינון שאלות לפי נושא"
            />
          </div>
        </div>

        {filtered.length > 0 ? (
          <ol className={styles.list}>
            {filtered.map((item, i) => (
              <li key={item.id}>
                <FAQRow
                  item={item}
                  num={String(i + 1).padStart(2, '0')}
                  isOpen={openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                  reduced={reduced}
                />
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyGlyph} aria-hidden>✕</span>
            <p className={styles.emptyText}>
              לא מצאנו נושא כזה. נסו ניסוח אחר, או הציעו אותו כהצבעה חדשה.
            </p>
          </div>
        )}

        {/* WhatsApp escalation — human help */}
        <div className={styles.escalate}>
          <span className={styles.escalateKicker}>
            <span aria-hidden className={styles.escalateTick} />
            עדיין תקועים?
          </span>
          <h3 className={styles.escalateTitle}>
            לא מצאתם? כתבו לנו בוואטסאפ,{' '}
            <span className={styles.red}>אנחנו אנשים אמיתיים.</span>
          </h3>
          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="lg"
            trailing={<span aria-hidden>←</span>}
          >
            דברו איתנו בוואטסאפ
          </NewsButton>
        </div>
      </div>
    </section>
  );
}
