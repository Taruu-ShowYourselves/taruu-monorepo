'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import { Button } from '@/components/ui/Button';
import styles from './FundTransparency.module.css';

export interface Expense {
  id: string;
  description: string;
  amount: number | null;
  date: string;
  category: string;
}

export interface FundRule {
  title: string;
  description: string;
}

export interface FundTransparencyData {
  balance: number | null;
  monthlyAccumulation: number | null;
  recentExpenses: Expense[];
  usageRules: FundRule[];
}

interface FundTransparencyProps {
  data?: FundTransparencyData;
}

const defaultData: FundTransparencyData = {
  balance: null,
  monthlyAccumulation: null,
  recentExpenses: [],
  usageRules: [
    {
      title: 'שקיפות מלאה',
      description: 'כל הוצאה מהקרן מתועדת ומפורסמת לציבור',
    },
    {
      title: 'אישור קהילתי',
      description: 'הוצאות מעל סכום מסוים דורשות הצבעה ואישור הקהילה',
    },
    {
      title: 'ביקורת חיצונית',
      description: 'הקרן עוברת ביקורת חשבונאית שנתית עצמאית',
    },
  ],
};

function formatCurrency(value: number | null): string {
  if (value === null) {
    return 'בקרוב';
  }
  return `₪${value.toLocaleString('he-IL')}`;
}

export function FundTransparency({ data = defaultData }: FundTransparencyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const fundData = { ...defaultData, ...data };
  const hasExpenses = fundData.recentExpenses.length > 0;

  return (
    <section className={styles.fundTransparency} id="fund-transparency">
      {/* Background Typography */}
      <div className={styles.backgroundText}>שקיפות</div>

      <div className={styles.container} ref={ref}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="primary" weight="semibold" align="center">
              שקיפות פיננסית
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center">
              שקיפות הקרן
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.2}>
            <Text size="base" color="muted" align="center" className={styles.subtitle}>
              אנו מאמינים בשקיפות מלאה. כל שקל שנכנס ויוצא מהקרן מתועד ונגיש לציבור.
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Stats Grid */}
        <motion.div
          className={styles.statsGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
        >
          {/* Balance Card */}
          <motion.div
            className={styles.statCard}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                },
              },
            }}
          >
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statLabel}>יתרת הקרן</div>
            <div className={`${styles.statValue} ${fundData.balance === null ? styles.placeholder : ''}`}>
              {formatCurrency(fundData.balance)}
            </div>
          </motion.div>

          {/* Monthly Accumulation Card */}
          <motion.div
            className={styles.statCard}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                },
              },
            }}
          >
            <div className={styles.statIcon}>📈</div>
            <div className={styles.statLabel}>הצטבר החודש</div>
            <div className={`${styles.statValue} ${fundData.monthlyAccumulation === null ? styles.placeholder : ''}`}>
              {formatCurrency(fundData.monthlyAccumulation)}
            </div>
          </motion.div>
        </motion.div>

        {/* Recent Expenses Section */}
        <motion.div
          className={styles.expensesSection}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className={styles.sectionHeader}>
            <Heading level={3}>הוצאות אחרונות</Heading>
          </div>
          <div className={styles.expensesList}>
            {hasExpenses ? (
              fundData.recentExpenses.map((expense) => (
                <div key={expense.id} className={styles.expenseItem}>
                  <div className={styles.expenseInfo}>
                    <Text weight="medium">{expense.description}</Text>
                    <Text size="sm" color="muted">{expense.category} • {expense.date}</Text>
                  </div>
                  <div className={styles.expenseAmount}>
                    {expense.amount !== null ? `₪${expense.amount.toLocaleString('he-IL')}` : 'בקרוב'}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <Text color="muted" align="center">בקרוב - טרם בוצעו הוצאות</Text>
              </div>
            )}
          </div>
        </motion.div>

        {/* Fund Usage Rules Section */}
        <motion.div
          className={styles.rulesSection}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className={styles.sectionHeader}>
            <Heading level={3}>כללי שימוש בקרן</Heading>
          </div>
          <div className={styles.rulesList}>
            {fundData.usageRules.map((rule, index) => (
              <div key={index} className={styles.ruleItem}>
                <div className={styles.ruleNumber}>{index + 1}</div>
                <div className={styles.ruleContent}>
                  <Text weight="semibold">{rule.title}</Text>
                  <Text size="sm" color="muted">{rule.description}</Text>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Fund Policy Link */}
        <motion.div
          className={styles.policyLink}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Link href="/fund-policy">
            <Button variant="outline" size="lg">
              לקריאת מדיניות הקרן המלאה
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
