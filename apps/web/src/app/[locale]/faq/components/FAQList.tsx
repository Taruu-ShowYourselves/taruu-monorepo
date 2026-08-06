'use client';

import { useState, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsButton, PressInput, Segmented } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import {
  faqData,
  faqDataEn,
  faqCategories,
  faqCategoriesEn,
  faqCategoryOrder,
  type FAQItem,
  type FAQCategory,
} from '../data/faqData';
import type { Locale } from '@/lib/i18n';
import styles from './FAQList.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

type FilterValue = 'all' | FAQCategory;

interface FAQListCopy {
  srTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  filterAriaLabel: string;
  allLabel: string;
  emptyText: string;
  escalateKicker: string;
  escalateTitleStart: string;
  escalateTitleAccent: string;
  ctaLabel: string;
  ctaGlyph: string;
  items: FAQItem[];
  categories: Record<FAQCategory, string>;
}

const COPY: Record<Locale, FAQListCopy> = {
  he: {
    srTitle: 'רשימת שאלות נפוצות',
    searchLabel: 'חיפוש',
    searchPlaceholder: 'חפשו נושא, מילה או שאלה…',
    filterLabel: 'סינון לפי נושא',
    filterAriaLabel: 'סינון שאלות לפי נושא',
    allLabel: 'הכול',
    emptyText: 'לא מצאנו נושא כזה. נסו ניסוח אחר, או הציעו אותו כהצבעה חדשה.',
    escalateKicker: 'עדיין תקועים?',
    escalateTitleStart: 'לא מצאתם? כתבו לנו בוואטסאפ,',
    escalateTitleAccent: 'אנחנו אנשים אמיתיים.',
    ctaLabel: 'דברו איתנו בוואטסאפ',
    ctaGlyph: '←',
    items: faqData,
    categories: faqCategories,
  },
  en: {
    srTitle: 'List of frequently asked questions',
    searchLabel: 'Search',
    searchPlaceholder: 'Search a topic, a word, or a question…',
    filterLabel: 'Filter by topic',
    filterAriaLabel: 'Filter questions by topic',
    allLabel: 'All',
    emptyText: 'We could not find that topic. Try different wording, or propose it as a new vote.',
    escalateKicker: 'Still stuck?',
    escalateTitleStart: 'Didn’t find it? Write to us on WhatsApp,',
    escalateTitleAccent: 'we are real people.',
    ctaLabel: 'Talk to us on WhatsApp',
    ctaGlyph: '→',
    items: faqDataEn,
    categories: faqCategoriesEn,
  },
};

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

interface FAQListProps {
  locale?: Locale;
}

export function FAQList({ locale = 'he' }: FAQListProps) {
  const t = COPY[locale];
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(t.items[0]?.id ?? null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');

  const segments: { value: FilterValue; label: string }[] = [
    { value: 'all', label: t.allLabel },
    ...faqCategoryOrder.map((c) => ({ value: c, label: t.categories[c] })),
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return t.items.filter((item) => {
      const matchesCategory = filter === 'all' || item.category === filter;
      const matchesQuery =
        q === '' ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [t.items, filter, query]);

  return (
    <section className={styles.section} aria-labelledby="faq-list-title">
      <div className={styles.container}>
        <h2 id="faq-list-title" className={styles.srOnly}>
          {t.srTitle}
        </h2>

        {/* Control bar: search + category filter */}
        <div className={styles.controls}>
          <PressInput
            label={t.searchLabel}
            type="search"
            inputMode="search"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.search}
          />
          <div className={styles.filterWrap}>
            <span className={styles.filterLabel}>{t.filterLabel}</span>
            <Segmented
              segments={segments}
              value={filter}
              onChange={setFilter}
              variant="red"
              aria-label={t.filterAriaLabel}
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
            <p className={styles.emptyText}>{t.emptyText}</p>
          </div>
        )}

        {/* WhatsApp escalation - human help */}
        <div className={styles.escalate}>
          <span className={styles.escalateKicker}>
            <span aria-hidden className={styles.escalateTick} />
            {t.escalateKicker}
          </span>
          <h3 className={styles.escalateTitle}>
            {t.escalateTitleStart}{' '}
            <span className={styles.red}>{t.escalateTitleAccent}</span>
          </h3>
          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="lg"
            trailing={<span aria-hidden>{t.ctaGlyph}</span>}
          >
            {t.ctaLabel}
          </NewsButton>
        </div>
      </div>
    </section>
  );
}
