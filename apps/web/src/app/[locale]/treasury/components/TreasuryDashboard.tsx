'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Segmented, TallyBar } from '@/components/press';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { useReducedMotion } from '@/hooks';
import { formatCurrency, formatDate, MUNICIPALITIES } from '@sync/shared';
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

const TRANSACTION_TYPE_LABELS: Record<Transaction['type'], string> = {
  deposit: 'הפקדה',
  allocation: 'הקצאה',
  withdrawal: 'משיכה',
  fee_claim: 'תביעת עמלות',
  token_purchase: 'רכישת טוקנים',
  nft_mint: 'הנפקת NFT',
};

/** Income / expense allocation rendered as a published ledger split. */
function AllocationLedger({ local, external }: { local: number; external: number }) {
  const total = local + external;
  const localPct = total > 0 ? (local / total) * 100 : 50;
  const externalPct = total > 0 ? (external / total) * 100 : 50;

  return (
    <div
      className={styles.allocationLedger}
      role="img"
      aria-label={`תרומות מקומיות ${localPct.toFixed(0)} אחוז, תמיכה חיצונית ${externalPct.toFixed(0)} אחוז`}
    >
      <div className={styles.allocationRow}>
        <span className={styles.allocationMark} aria-hidden>
          ■
        </span>
        <span className={styles.allocationName}>תרומות מקומיות</span>
        <TallyBar pct={localPct} selected />
        <span className={styles.allocationPct}>{localPct.toFixed(0)}%</span>
      </div>
      <div className={styles.allocationRow}>
        <span className={styles.allocationMark} aria-hidden>
          □
        </span>
        <span className={styles.allocationName}>תמיכה חיצונית</span>
        <TallyBar pct={externalPct} />
        <span className={styles.allocationPct}>{externalPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

/** Single ledger line - type · description · date · amount, dotted leader. */
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const label = TRANSACTION_TYPE_LABELS[transaction.type];
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
function ComingSoonBoard() {
  return (
    <div className={styles.emptyBoard}>
      <span className={styles.emptyMark} aria-hidden>
        ●
      </span>
      <h3 className={styles.emptyTitle}>בקרוב</h3>
      <p className={styles.emptyText}>הדשבורד החי ייפתח עם ההצבעה הראשונה.</p>
    </div>
  );
}

export function TreasuryDashboard() {
  const reduced = useReducedMotion();
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(MUNICIPALITIES[0]);

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
                  TRANSACTION_TYPE_LABELS[t.type as Transaction['type']] ||
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
  }, [selectedMunicipality]);

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
            הדשבורד החי
          </span>
          <h2 id="treasury-board-title" className={styles.boardTitle}>
            לוח שקיפות <span className={styles.red}>בזמן אמת.</span>
          </h2>
        </header>

        {/* Municipality selector - press segmented control */}
        <div className={styles.selectorRow}>
          <span className={styles.selectLabel}>בחירת רשות</span>
          <Segmented
            aria-label="בחירת רשות"
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
            <span className={styles.statLabel}>יתרה כוללת</span>
            <span className={styles.statValue}>{formatCurrency(treasury.totalILS)}</span>
            <span className={styles.statMeta}>{treasury.totalSOL.toFixed(2)} SOL</span>
          </motion.div>

          <motion.div className={styles.statCard} variants={fadeInUp}>
            <span className={styles.statLabel}>תרומות מקומיות</span>
            <span className={styles.statValue}>{formatCurrency(treasury.localContributions)}</span>
            <span className={styles.statMeta}>מתושבי הרשות</span>
          </motion.div>

          <motion.div className={styles.statCard} variants={fadeInUp}>
            <span className={styles.statLabel}>תמיכה חיצונית</span>
            <span className={styles.statValue}>{formatCurrency(treasury.externalContributions)}</span>
            <span className={styles.statMeta}>מתומכים חיצוניים</span>
          </motion.div>

          <motion.div className={`${styles.statCard} ${styles.multiplierCard}`} variants={fadeInUp}>
            <span className={styles.statLabel}>מכפיל SocialFi</span>
            <span className={styles.statValue}>
              {multiplier.toFixed(2)}
              <span className={styles.multiplierX}>x</span>
            </span>
            <span className={styles.statMeta}>כל ₪1 מקומי הפך ל-₪{multiplier.toFixed(2)}</span>
          </motion.div>
        </motion.div>

        {/* Allocation breakdown - ledger split, real figures only */}
        <motion.div
          className={styles.board}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionTick} aria-hidden />
            התפלגות הכנסות
          </h3>

          <AllocationLedger
            local={treasury.localContributions}
            external={treasury.externalContributions}
          />

          {/*
            An allocation Receipt stood here, multiplying the fund balance by
            two fixed percentages and printing the products as if the ledger
            had produced them. Nothing implements that split - the payments
            webhook credits the treasury the full amount. A real allocation
            ledger is COIN-02's to establish, and it is gated on COIN-01's
            written legal sign-off, so until that ledger exists nothing on this
            board may assert a split. The ledger split above is the one
            breakdown the data supports, and the stat cards already carry the
            fund total. The receipt's footer went with it rather than being
            reworded: it claimed an independent accounting audit that has never
            been commissioned, and a chain signature over ILS figures that live
            in Postgres.
          */}
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
            <span className={styles.activityLabel}>הצבעות שהסתיימו</span>
          </div>
          <div className={styles.activityCard}>
            <span className={styles.activityValue}>{treasury.activeVotes}</span>
            <span className={styles.activityLabel}>הצבעות פעילות</span>
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
            היסטוריית תנועות
          </h3>

          {treasury.transactions.length > 0 ? (
            <motion.div
              className={styles.txList}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {treasury.transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </motion.div>
          ) : (
            <ComingSoonBoard />
          )}
        </motion.div>
      </div>
    </section>
  );
}
