'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Segmented, Receipt, TallyBar } from '@/components/press';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { useReducedMotion } from '@/hooks';
import { formatCurrency, formatDate, MUNICIPALITIES } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './TreasuryDashboard.module.css';

const EASE = [0.2, 0, 0, 1] as const;

interface TreasuryData {
  municipalityId: string;
  municipalityName: string;
  totalILS: number;
  totalSOL: number;
  localContributions: number;
  externalContributions: number;
  activeVotes: number;
  totalVotesResolved: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: 'deposit' | 'allocation' | 'withdrawal' | 'fee_claim' | 'token_purchase' | 'nft_mint';
  amountILS: number;
  amountSOL?: number;
  description: string;
  createdAt: string;
  voteTitle?: string;
}

/** Honest empty board for a municipality with no treasury activity yet. */
const emptyTreasury = (municipality: string): TreasuryData => ({
  municipalityId: municipality,
  municipalityName: municipality,
  totalILS: 0,
  totalSOL: 0,
  localContributions: 0,
  externalContributions: 0,
  activeVotes: 0,
  totalVotesResolved: 0,
  transactions: [],
});

interface TreasuryDashboardProps {
  locale?: Locale;
}

interface TreasuryDashboardCopy {
  txTypes: Record<Transaction['type'], string>;
  allocationAria: (localPct: string, externalPct: string) => string;
  allocationLocal: string;
  allocationExternal: string;
  emptyTitle: string;
  emptyText: string;
  boardKicker: string;
  boardTitle: string;
  boardTitleRed: string;
  selectLabel: string;
  statBalance: string;
  statLocal: string;
  statLocalMeta: string;
  statExternal: string;
  statExternalMeta: string;
  statMultiplier: string;
  multiplierMeta: (x: string) => string;
  allocationTitle: string;
  receiptKicker: string;
  receiptFund: string;
  receiptOps: string;
  receiptTotal: string;
  receiptFooter: string;
  resolvedLabel: string;
  activeLabel: string;
  historyTitle: string;
}

const COPY: Record<Locale, TreasuryDashboardCopy> = {
  he: {
    txTypes: {
      deposit: 'הפקדה',
      allocation: 'הקצאה',
      withdrawal: 'משיכה',
      fee_claim: 'תביעת עמלות',
      token_purchase: 'רכישת טוקנים',
      nft_mint: 'הנפקת NFT',
    },
    allocationAria: (localPct, externalPct) =>
      `תרומות מקומיות ${localPct} אחוז, תמיכה חיצונית ${externalPct} אחוז`,
    allocationLocal: 'תרומות מקומיות',
    allocationExternal: 'תמיכה חיצונית',
    emptyTitle: 'בקרוב',
    emptyText: 'הדשבורד החי ייפתח עם ההצבעה הראשונה.',
    boardKicker: 'הדשבורד החי',
    boardTitle: 'לוח שקיפות',
    boardTitleRed: 'בזמן אמת.',
    selectLabel: 'בחירת רשות',
    statBalance: 'יתרה כוללת',
    statLocal: 'תרומות מקומיות',
    statLocalMeta: 'מתושבי הרשות',
    statExternal: 'תמיכה חיצונית',
    statExternalMeta: 'מתומכים חיצוניים',
    statMultiplier: 'מכפיל SocialFi',
    multiplierMeta: (x) => `כל ₪1 מקומי הפך ל-₪${x}`,
    allocationTitle: 'התפלגות הכנסות',
    receiptKicker: 'חלוקה · ALLOCATION',
    receiptFund: '70% לקרן הרשות',
    receiptOps: '30% תפעול הפלטפורמה',
    receiptTotal: 'סך הקרן',
    receiptFooter: 'כל סכום מתועד · חתום בבלוקצ׳יין · ביקורת חשבונאית עצמאית',
    resolvedLabel: 'הצבעות שהסתיימו',
    activeLabel: 'הצבעות פעילות',
    historyTitle: 'היסטוריית תנועות',
  },
  en: {
    txTypes: {
      deposit: 'Deposit',
      allocation: 'Allocation',
      withdrawal: 'Withdrawal',
      fee_claim: 'Fee claim',
      token_purchase: 'Token purchase',
      nft_mint: 'NFT mint',
    },
    allocationAria: (localPct, externalPct) =>
      `Local contributions ${localPct} percent, external support ${externalPct} percent`,
    allocationLocal: 'Local contributions',
    allocationExternal: 'External support',
    emptyTitle: 'Coming soon',
    emptyText: 'The live dashboard opens with the first vote.',
    boardKicker: 'The live dashboard',
    boardTitle: 'A transparency board,',
    boardTitleRed: 'in real time.',
    selectLabel: 'Choose a municipality',
    statBalance: 'Total balance (ILS)',
    statLocal: 'Local contributions',
    statLocalMeta: 'From the municipality’s residents',
    statExternal: 'External support',
    statExternalMeta: 'From outside backers',
    statMultiplier: 'SocialFi multiplier',
    multiplierMeta: (x) => `Every local ₪1 became ₪${x}`,
    allocationTitle: 'Revenue breakdown',
    receiptKicker: 'The split · ALLOCATION',
    receiptFund: '70% to the municipal fund',
    receiptOps: '30% platform operations',
    receiptTotal: 'Fund total',
    receiptFooter: 'Every amount recorded · Signed on the blockchain · Independent accounting audit',
    resolvedLabel: 'Votes concluded',
    activeLabel: 'Active votes',
    historyTitle: 'Transaction history',
  },
};

/** Income / expense allocation rendered as a published ledger split. */
function AllocationLedger({
  local,
  external,
  t,
}: {
  local: number;
  external: number;
  t: TreasuryDashboardCopy;
}) {
  const total = local + external;
  const localPct = total > 0 ? (local / total) * 100 : 50;
  const externalPct = total > 0 ? (external / total) * 100 : 50;

  return (
    <div
      className={styles.allocationLedger}
      role="img"
      aria-label={t.allocationAria(localPct.toFixed(0), externalPct.toFixed(0))}
    >
      <div className={styles.allocationRow}>
        <span className={styles.allocationMark} aria-hidden>
          ■
        </span>
        <span className={styles.allocationName}>{t.allocationLocal}</span>
        <TallyBar pct={localPct} selected />
        <span className={styles.allocationPct}>{localPct.toFixed(0)}%</span>
      </div>
      <div className={styles.allocationRow}>
        <span className={styles.allocationMark} aria-hidden>
          □
        </span>
        <span className={styles.allocationName}>{t.allocationExternal}</span>
        <TallyBar pct={externalPct} />
        <span className={styles.allocationPct}>{externalPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

/** Single ledger line - type · description · date · amount, dotted leader. */
function TransactionRow({
  transaction,
  typeLabels,
}: {
  transaction: Transaction;
  typeLabels: TreasuryDashboardCopy['txTypes'];
}) {
  const label = typeLabels[transaction.type];
  const isPositive = transaction.amountILS >= 0;

  return (
    <motion.div className={styles.txRow} variants={fadeInUp}>
      <div className={styles.txMain}>
        <span className={`${styles.txMark} ${isPositive ? styles.txIn : styles.txOut}`} aria-hidden>
          {isPositive ? '+' : '−'}
        </span>
        <div className={styles.txInfo}>
          <span className={styles.txDesc}>{transaction.description}</span>
          {transaction.voteTitle && <span className={styles.txVote}>{transaction.voteTitle}</span>}
        </div>
      </div>
      <span className={styles.txLeader} aria-hidden />
      <div className={styles.txMeta}>
        <span className={styles.txBadge}>{label}</span>
        <span className={styles.txDate}>{formatDate(new Date(transaction.createdAt))}</span>
      </div>
      <span className={`${styles.txAmount} ${isPositive ? styles.positive : styles.negative}`}>
        {isPositive ? '+' : ''}
        {formatCurrency(transaction.amountILS)}
      </span>
    </motion.div>
  );
}

/** Premium loading skeletons - shimmer ledger placeholders. */
function DashboardSkeleton() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.selectorRow}>
          <span className={`${styles.skeleton} ${styles.skelSelect}`} />
        </div>
        <div className={styles.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${styles.statCard} ${styles.skelCard}`}>
              <span className={`${styles.skeleton} ${styles.skelLabel}`} />
              <span className={`${styles.skeleton} ${styles.skelValue}`} />
              <span className={`${styles.skeleton} ${styles.skelMeta}`} />
            </div>
          ))}
        </div>
        <div className={`${styles.board} ${styles.skelBoard}`}>
          <span className={`${styles.skeleton} ${styles.skelTitle}`} />
          <span className={`${styles.skeleton} ${styles.skelChart}`} />
        </div>
      </div>
    </section>
  );
}

/** Honest "coming soon" empty state - never fake metrics. */
function ComingSoonBoard({ t }: { t: TreasuryDashboardCopy }) {
  return (
    <div className={styles.emptyBoard}>
      <span className={styles.emptyMark} aria-hidden>
        ●
      </span>
      <h3 className={styles.emptyTitle}>{t.emptyTitle}</h3>
      <p className={styles.emptyText}>{t.emptyText}</p>
    </div>
  );
}

export function TreasuryDashboard({ locale = 'he' }: TreasuryDashboardProps) {
  const reduced = useReducedMotion();
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(MUNICIPALITIES[0]);
  const t = COPY[locale];

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        // Summary: { treasury: { balanceILS, balanceSOL, totalCollectedILS, activeVotesCount, ... } }
        const res = await fetch(`/api/treasury/${selectedMunicipality}`);
        const summary = res.ok
          ? ((await res.json()).treasury as Record<string, number> | null)
          : null;

        // Ledger from the dedicated endpoint (the split + resolved count are
        // derived from it - never fabricated).
        let transactions: Transaction[] = [];
        try {
          const txRes = await fetch(
            `/api/treasury/${selectedMunicipality}/transactions?limit=25`
          );
          if (txRes.ok) {
            const txData = await txRes.json();
            transactions = ((txData.transactions || []) as Record<string, unknown>[]).map(
              (t): Transaction => ({
                id: String(t.id),
                type: t.type as Transaction['type'],
                amountILS: typeof t.amountILS === 'number' ? t.amountILS : 0,
                amountSOL: typeof t.amountSOL === 'number' ? t.amountSOL : undefined,
                description:
                  (t.description as string) ||
                  COPY[locale].txTypes[t.type as Transaction['type']] ||
                  '',
                createdAt: String(t.createdAt),
                voteTitle: t.voteTitle as string | undefined,
              })
            );
          }
        } catch {
          // No ledger - leave transactions empty.
        }

        const local = transactions
          .filter((t) => t.type === 'deposit')
          .reduce((s, t) => s + Math.max(0, t.amountILS), 0);
        const external = transactions
          .filter((t) => t.type === 'token_purchase' || t.type === 'fee_claim')
          .reduce((s, t) => s + Math.max(0, t.amountILS), 0);
        const resolved = new Set(
          transactions.map((t) => t.voteTitle).filter(Boolean)
        ).size;

        setTreasury({
          municipalityId: selectedMunicipality,
          municipalityName: selectedMunicipality,
          totalILS: summary?.totalCollectedILS ?? summary?.balanceILS ?? 0,
          totalSOL: summary?.balanceSOL ?? 0,
          localContributions: local,
          externalContributions: external,
          activeVotes: summary?.activeVotesCount ?? 0,
          totalVotesResolved: resolved,
          transactions,
        });
      } catch (err) {
        console.error('Error fetching treasury:', err);
        // Honest empty board - never fabricated figures.
        setTreasury(emptyTreasury(selectedMunicipality));
      } finally {
        setLoading(false);
      }
    };

    fetchTreasury();
  }, [selectedMunicipality, locale]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!treasury) return null;

  const multiplier =
    treasury.localContributions > 0
      ? (treasury.localContributions + treasury.externalContributions) / treasury.localContributions
      : 1;

  return (
    <section className={styles.section} aria-labelledby="treasury-board-title">
      <div className={styles.container}>
        <header className={styles.boardHead}>
          <span className={styles.boardKicker}>
            <span className={styles.live} aria-hidden />
            {t.boardKicker}
          </span>
          <h2 id="treasury-board-title" className={styles.boardTitle}>
            {t.boardTitle} <span className={styles.red}>{t.boardTitleRed}</span>
          </h2>
        </header>

        {/* Municipality selector - press segmented control */}
        <div className={styles.selectorRow}>
          <span className={styles.selectLabel}>{t.selectLabel}</span>
          <Segmented
            aria-label={t.selectLabel}
            value={selectedMunicipality}
            onChange={(value) => {
              setSelectedMunicipality(value);
              setLoading(true);
            }}
            segments={MUNICIPALITIES.map((m) => ({ value: m, label: m }))}
          />
        </div>

        {/* Stats - boxed mono tabular figures */}
        <motion.div
          className={styles.statsGrid}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div className={`${styles.statCard} ${styles.statBalance}`} variants={fadeInUp}>
            <span className={styles.statLabel}>{t.statBalance}</span>
            <span className={styles.statValue}>{formatCurrency(treasury.totalILS)}</span>
            <span className={styles.statMeta}>{treasury.totalSOL.toFixed(2)} SOL</span>
          </motion.div>

          <motion.div className={styles.statCard} variants={fadeInUp}>
            <span className={styles.statLabel}>{t.statLocal}</span>
            <span className={styles.statValue}>{formatCurrency(treasury.localContributions)}</span>
            <span className={styles.statMeta}>{t.statLocalMeta}</span>
          </motion.div>

          <motion.div className={styles.statCard} variants={fadeInUp}>
            <span className={styles.statLabel}>{t.statExternal}</span>
            <span className={styles.statValue}>{formatCurrency(treasury.externalContributions)}</span>
            <span className={styles.statMeta}>{t.statExternalMeta}</span>
          </motion.div>

          <motion.div className={`${styles.statCard} ${styles.multiplierCard}`} variants={fadeInUp}>
            <span className={styles.statLabel}>{t.statMultiplier}</span>
            <span className={styles.statValue}>
              {multiplier.toFixed(2)}
              <span className={styles.multiplierX}>x</span>
            </span>
            <span className={styles.statMeta}>{t.multiplierMeta(multiplier.toFixed(2))}</span>
          </motion.div>
        </motion.div>

        {/* Allocation breakdown - ledger split + receipt */}
        <motion.div
          className={styles.board}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionTick} aria-hidden />
            {t.allocationTitle}
          </h3>

          <AllocationLedger
            local={treasury.localContributions}
            external={treasury.externalContributions}
            t={t}
          />

          <Receipt
            className={styles.allocReceipt}
            kicker={t.receiptKicker}
            rows={[
              {
                label: t.receiptFund,
                value: formatCurrency(treasury.totalILS * 0.7),
              },
              {
                label: t.receiptOps,
                value: formatCurrency(treasury.totalILS * 0.3),
              },
              {
                label: t.receiptTotal,
                value: formatCurrency(treasury.totalILS),
                strong: true,
              },
            ]}
            footer={t.receiptFooter}
          />
        </motion.div>

        {/* Activity counters */}
        <motion.div
          className={styles.activityGrid}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className={styles.activityCard}>
            <span className={styles.activityValue}>{treasury.totalVotesResolved}</span>
            <span className={styles.activityLabel}>{t.resolvedLabel}</span>
          </div>
          <div className={styles.activityCard}>
            <span className={styles.activityValue}>{treasury.activeVotes}</span>
            <span className={styles.activityLabel}>{t.activeLabel}</span>
          </div>
        </motion.div>

        {/* Transaction ledger */}
        <motion.div
          className={styles.board}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionTick} aria-hidden />
            {t.historyTitle}
          </h3>

          {treasury.transactions.length > 0 ? (
            <motion.div
              className={styles.txList}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {treasury.transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} typeLabels={t.txTypes} />
              ))}
            </motion.div>
          ) : (
            <ComingSoonBoard t={t} />
          )}
        </motion.div>
      </div>
    </section>
  );
}
