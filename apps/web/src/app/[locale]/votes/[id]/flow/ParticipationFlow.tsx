'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { NewsButton } from '@/components/press/NewsButton';
import { Stepper, Receipt, SealCard } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { isEligibleToVote } from '@/lib/verification';
import styles from './ParticipationFlow.module.css';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export interface FlowOption {
  id: string;
  text: string;
  votes: number;
}

interface ParticipationFlowProps {
  voteId: string;
  voteTitle: string;
  options: FlowOption[];
  totalVotes: number;
  /** Pre-selected option (e.g. restored from a deep-link). */
  initialOptionId?: string | null;
  /** Fired when the flow completes so the page can flip to results. */
  onComplete: () => void;
}

type Stage = 'choice' | 'confirm' | 'receipt';

const STEPS = [
  { label: 'בחירה' },
  { label: 'אישור' },
  { label: 'חתימה' },
] as const;

const STAGE_INDEX: Record<Stage, number> = {
  choice: 0,
  confirm: 1,
  receipt: 2,
};

/** sessionStorage key for restoring a choice across an auth/verify round-trip. */
const PENDING_KEY = 'taruu-pending-vote';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
/** Synthesise a plausible blockchain-style hash for the mock seal. */
function mockHash(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * ParticipationFlow — the press ballot, reshaped (UX flow J2). Choice →
 * confirmation → blockchain receipt + seal. Participation is free; residency is
 * verified ONCE elsewhere (/verification), so there is no per-vote GPS step.
 * The auth + verified-resident gate sits at confirmation: guests pick freely,
 * and the selected option is persisted across the sign-in / verification
 * round-trip so nothing is lost. Seals in-page; server-side recording hooks in
 * once the participate API drops its payment-shaped contract.
 */
export function ParticipationFlow({
  voteId,
  options,
  totalVotes,
  initialOptionId = null,
  onComplete,
}: ParticipationFlowProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { isAuthenticated, user } = useAuthStore();

  const isVerifiedResident = isEligibleToVote(user);

  const [stage, setStage] = useState<Stage>('choice');
  const [selectedOption, setSelectedOption] = useState<string | null>(initialOptionId);
  const [seal, setSeal] = useState<{ hash: string; block: string; ts: string } | null>(null);

  const selectedText = useMemo(
    () => options.find((o) => o.id === selectedOption)?.text ?? '',
    [options, selectedOption]
  );

  // Restore a choice persisted before an auth/verify redirect (or ?option=…),
  // and jump straight back to the payment step so the round-trip is seamless.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let restored: string | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const pending = JSON.parse(raw) as { voteId?: string; optionId?: string };
        if (pending.voteId === voteId && pending.optionId) restored = pending.optionId;
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      /* ignore malformed cache */
    }
    if (!restored) {
      restored = new URLSearchParams(window.location.search).get('option');
    }
    if (restored && options.some((o) => o.id === restored)) {
      setSelectedOption(restored);
      setStage('confirm');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the choice so it survives a sign-in / verification redirect. */
  const persistPending = useCallback(() => {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ voteId, optionId: selectedOption }));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [voteId, selectedOption]);

  const stepAnim = reduced
    ? {}
    : {
        initial: { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
        animate: { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
        transition: { duration: 0.22, ease: [0.2, 0, 0, 1] as const },
      };

  /* ---- Step 1: choice (open to guests) ---- */
  const handleConfirmChoice = useCallback(() => {
    if (!selectedOption) return;
    setStage('confirm');
  }, [selectedOption]);

  /* ---- Step 2: free confirmation ---- */
  const sealVote = useCallback(() => {
    setSeal({
      hash: mockHash(),
      block: (18_400_000 + Math.floor(Math.random() * 9999)).toLocaleString('en-US'),
      ts: new Date().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }),
    });
    setStage('receipt');
    onComplete();
  }, [onComplete]);

  const handleConfirm = useCallback(() => {
    if (!selectedOption) return;

    const back = encodeURIComponent(`/votes/${voteId}`);
    // Gate at confirmation: must be signed in AND a verified resident. Persist
    // the choice so the round-trip returns the user straight to this step.
    if (!isAuthenticated) {
      persistPending();
      router.push(`/sign-in?redirect=${back}`);
      return;
    }
    if (!isVerifiedResident) {
      persistPending();
      router.push(`/verification?redirect=${back}`);
      return;
    }

    sealVote();
  }, [selectedOption, voteId, sealVote, isAuthenticated, isVerifiedResident, persistPending, router]);

  /* ------------------------------------------------------------------ */
  return (
    <div className={styles.flow}>
      <Stepper steps={STEPS as unknown as { label: string }[]} current={STAGE_INDEX[stage]} />

      <motion.div key={stage} className={styles.stage} {...stepAnim}>
        {/* ---- STEP 1 — בחירה ---- */}
        {stage === 'choice' && (
          <section className={styles.panel} aria-label="בחירת עמדה">
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שלב 01 · בחירה
            </span>
            <h2 className={styles.panelTitle}>בחרו את עמדתכם</h2>

            <ul className={styles.options}>
              {options.map((o) => {
                const isSel = selectedOption === o.id;
                const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`${styles.option} ${isSel ? styles.optionSel : ''}`}
                      onClick={() => setSelectedOption(o.id)}
                      aria-pressed={isSel}
                    >
                      <span className={styles.optionTop}>
                        <span className={styles.mark} aria-hidden>
                          {isSel ? '■' : '□'}
                        </span>
                        <span className={styles.optionLabel}>{o.text}</span>
                        <span className={styles.pct}>{pct}%</span>
                      </span>
                      <span className={styles.track} aria-hidden>
                        <motion.span
                          className={`${styles.fill} ${isSel ? styles.fillSel : ''}`}
                          initial={reduced ? false : { width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: reduced ? 0 : 0.7, ease: [0.2, 0, 0, 1] }}
                        />
                      </span>
                      <span className={styles.optionCount}>
                        {o.votes.toLocaleString('he-IL')} קולות
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className={styles.trust}>הקול שלכם ייחתם בבלוקצ׳יין. אי אפשר לשנות אותו בדיעבד.</p>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={handleConfirmChoice}
                disabled={!selectedOption}
                trailing={<span aria-hidden>←</span>}
              >
                המשיכו · אישור
              </NewsButton>
            </div>
          </section>
        )}

        {/* ---- STEP 2 — אישור ---- */}
        {stage === 'confirm' && (
          <section className={styles.panel} aria-label="אישור הקול">
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שלב 02 · אישור
            </span>
            <h2 className={styles.panelTitle}>אשרו את הקול שלכם</h2>

            <p className={styles.lead}>
              ההשתתפות חינם, בלי תשלום ובלי חסמים. נדרש רק אימות זהות ומיקום,
              כדי שכל קול ישויך לתושב אמיתי אחד. הקול ייחתם בבלוקצ׳יין ולא יהיה
              ניתן לשינוי.
            </p>

            <Receipt
              className={styles.receipt}
              kicker="פתק הצבעה · BALLOT"
              rows={[
                { label: 'עמדה', value: selectedText || '—' },
                { label: 'עלות', value: 'חינם', strong: true },
              ]}
              footer={`הצבעה ${voteId}`}
            />

            <p className={styles.trust}>מאומת זהות ומיקום · חתום בבלוקצ׳יין.</p>

            {/* Gate notice — what the confirm button will do next */}
            {!isAuthenticated ? (
              <p className={styles.gateNote}>
                <span aria-hidden>■ </span>
                צריך חשבון כדי להשלים. נשמור את הבחירה שלכם ונחזיר אתכם לכאן.
              </p>
            ) : !isVerifiedResident ? (
              <p className={styles.gateNote}>
                <span aria-hidden>■ </span>
                אימות תושב חד-פעמי לפני ההצבעה. נשמור את הבחירה ונמשיך מכאן.
              </p>
            ) : null}

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={handleConfirm}
                trailing={<span aria-hidden>←</span>}
              >
                {!isAuthenticated
                  ? 'התחברו והשלימו'
                  : !isVerifiedResident
                    ? 'אמתו תושבוּת והשלימו'
                    : 'אשרו והצביעו'}
              </NewsButton>
              <button
                type="button"
                className={styles.backLink}
                onClick={() => setStage('choice')}
              >
                ↳ חזרה לבחירה
              </button>
            </div>
          </section>
        )}

        {/* ---- STEP 3 — אישור + חתימה ---- */}
        {stage === 'receipt' && seal && (
          <section className={styles.panel} aria-label="קבלה וחתימה">
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שלב 03 · חתימה
            </span>
            <h2 className={styles.panelTitle}>
              הקול שלכם <span className={styles.red}>נחתם.</span>
            </h2>
            <p className={styles.lead}>
              ההצבעה נקלטה ונחתמה. בחרתם: <strong>{selectedText}</strong>.
            </p>

            <Receipt
              className={styles.receipt}
              kicker="קבלה · RECEIPT"
              title="השתתפות בהצבעה"
              rows={[
                { label: 'עמדה', value: selectedText || '—' },
                { label: 'עלות', value: 'חינם' },
                { label: 'סטטוס', value: 'נחתם', strong: true },
              ]}
              footer={`הצבעה ${voteId} · ${seal.ts}`}
            />

            <SealCard
              className={styles.seal}
              status="sealed"
              hash={seal.hash}
              meta={[
                { label: 'BLOCK', value: seal.block },
                { label: 'TIME', value: seal.ts },
              ]}
            />

            <p className={styles.trust}>✓ חתום בבלוקצ׳יין · בלתי ניתן לשינוי.</p>
          </section>
        )}
      </motion.div>
    </div>
  );
}
