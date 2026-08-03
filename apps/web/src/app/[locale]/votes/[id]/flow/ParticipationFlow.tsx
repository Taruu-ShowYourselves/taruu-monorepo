'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { NewsButton } from '@/components/press/NewsButton';
import { Stepper, Receipt } from '@/components/press';
import { useReducedMotion } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import {
  submitParticipation,
  isTerminalRejection,
  type ParticipationRejectionCode,
  type RecordedBallot,
} from './submitParticipation';
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
  /** Fired when the receipt is dismissed, with the recorded option id, so the page can flip to results. */
  onComplete: (optionId: string) => void;
}

type Stage = 'choice' | 'confirm' | 'receipt';

const STEPS = [
  { label: 'בחירה' },
  { label: 'אישור' },
  { label: 'רישום' },
] as const;

const STAGE_INDEX: Record<Stage, number> = {
  choice: 0,
  confirm: 1,
  receipt: 2,
};

/** sessionStorage key for restoring a choice across an auth/verify round-trip. */
const PENDING_KEY = 'taruu-pending-vote';

/**
 * ParticipationFlow - the press ballot, reshaped (UX flow J2). Choice →
 * confirmation → server-recorded receipt. Residency is verified ONCE
 * elsewhere (/verification), so there is no per-vote GPS step.
 *
 * Only the sign-in gate is evaluated client-side, because "no session" is
 * unambiguous here. Residency is decided solely by the server: the client's
 * `isEligibleToVote` depends on `checkInsCompleted`, which this screen never
 * loads, so gating on it turned away residents the server accepts. A 403
 * routes them to /verification instead. Guests pick freely, and the selected
 * option is persisted across either round-trip so nothing is lost. The ballot
 * is persisted by
 * `POST /api/votes/[id]/participate` - via `submitParticipation` - before the
 * receipt is shown; nothing here is chain-anchored.
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
  const { isAuthenticated } = useAuthStore();

  const [stage, setStage] = useState<Stage>('choice');
  const [selectedOption, setSelectedOption] = useState<string | null>(initialOptionId);
  const [ballot, setBallot] = useState<RecordedBallot | null>(null);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorCode, setSubmitErrorCode] = useState<ParticipationRejectionCode | null>(null);

  /** A rejection retrying cannot fix - the confirm button stops offering one. */
  const isBlocked = submitErrorCode !== null && isTerminalRejection(submitErrorCode);

  const selectedText = useMemo(
    () => options.find((o) => o.id === selectedOption)?.text ?? '',
    [options, selectedOption]
  );

  /**
   * The position the SERVER recorded - which is not always the one just
   * clicked. On the already-recorded path the API returns the existing
   * ballot, so a resident who voted differently before would otherwise be
   * shown a position they never cast. The receipt states server facts only.
   */
  const recordedText = useMemo(
    () => (ballot ? (options.find((o) => o.id === ballot.optionId)?.text ?? '') : ''),
    [options, ballot]
  );

  const recordedAt = useMemo(
    () =>
      ballot
        ? new Date(ballot.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
        : '',
    [ballot]
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
      /* storage unavailable - non-fatal */
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

  /* ---- Step 2: server-confirmed recording ---- */
  const recordVote = useCallback(async () => {
    if (!selectedOption || submitting || isBlocked) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitErrorCode(null);
    const result = await submitParticipation({ voteId, optionId: selectedOption });
    setSubmitting(false);
    if (result.status === 'rejected') {
      // The server is the only authority on eligibility. When it says the
      // resident still needs to verify, route them there rather than leaving
      // them staring at an error they cannot clear from this screen.
      if (result.code === 'RESIDENCY_NOT_VERIFIED' || result.code === 'IDENTITY_NOT_VERIFIED') {
        persistPending();
        router.push(`/verification?redirect=${encodeURIComponent(`/votes/${voteId}`)}`);
        return;
      }
      if (result.code === 'UNAUTHENTICATED') {
        persistPending();
        router.push(`/sign-in?redirect=${encodeURIComponent(`/votes/${voteId}`)}`);
        return;
      }
      setSubmitError(result.message);
      setSubmitErrorCode(result.code);
      return; // stay on 'confirm'; no receipt, no onComplete
    }
    setBallot(result.ballot);
    setAlreadyRecorded(result.alreadyRecorded);
    setStage('receipt');
  }, [selectedOption, submitting, isBlocked, voteId, persistPending, router]);

  const handleConfirm = useCallback(async () => {
    if (!selectedOption) return;

    const back = encodeURIComponent(`/votes/${voteId}`);
    // Sign-in is gated client-side because the answer is unambiguous here: no
    // session means no request worth making.
    //
    // Residency is NOT gated client-side. `isEligibleToVote` reads
    // `verificationStatus.checkInsCompleted`, which only `/api/verification/status`
    // ever populates and which the vote page never fetches - so on this screen
    // it is always undefined and the client rule collapses to "fully verified".
    // The server's rule is broader (verified OR at least one check-in), which is
    // the actual product decision. Gating on the narrower client value blocked
    // residents the server would have accepted. The request is attempted and
    // the server's 403 routes them, so there is exactly one eligibility rule.
    if (!isAuthenticated) {
      persistPending();
      router.push(`/sign-in?redirect=${back}`);
      return;
    }

    await recordVote();
  }, [selectedOption, voteId, recordVote, isAuthenticated, persistPending, router]);

  /* ------------------------------------------------------------------ */
  return (
    <div className={styles.flow}>
      <Stepper steps={STEPS as unknown as { label: string }[]} current={STAGE_INDEX[stage]} />

      <motion.div key={stage} className={styles.stage} {...stepAnim}>
        {/* ---- STEP 1 - בחירה ---- */}
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

            <p className={styles.trust}>
              הקול שלכם נרשם פעם אחת ומשויך לתושב מאומת. אי אפשר לשנות אותו בדיעבד.
            </p>

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

        {/* ---- STEP 2 - אישור ---- */}
        {stage === 'confirm' && (
          <section className={styles.panel} aria-label="אישור הקול">
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שלב 02 · אישור
            </span>
            <h2 className={styles.panelTitle}>אשרו את הקול שלכם</h2>

            <p className={styles.lead}>
              נדרש אימות זהות ותושבוּת חד-פעמי, כדי שכל קול ישויך לתושב אמיתי אחד.
              הקול נרשם פעם אחת ואי אפשר לשנות אותו.
            </p>

            <Receipt
              className={styles.receipt}
              kicker="פתק הצבעה · BALLOT"
              rows={[{ label: 'עמדה', value: selectedText || '-', strong: true }]}
              footer={`הצבעה ${voteId}`}
            />

            <p className={styles.trust}>מאומת זהות ותושבוּת · נרשם פעם אחת.</p>

            {/* Gate notice - only for the one gate this screen can answer.
                Residency is decided by the server; guessing it here would
                tell an eligible resident to go verify something they already
                have. If the server disagrees, it routes them to /verification
                with the choice preserved. */}
            {!isAuthenticated && (
              <p className={styles.gateNote}>
                <span aria-hidden>■ </span>
                צריך חשבון כדי להשלים. נשמור את הבחירה שלכם ונחזיר אתכם לכאן.
              </p>
            )}

            {submitError && (
              <p className={styles.errorNote} role="alert">
                <span aria-hidden>■ </span>
                {submitError}
              </p>
            )}

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={handleConfirm}
                disabled={submitting || isBlocked}
                trailing={isBlocked ? undefined : <span aria-hidden>←</span>}
              >
                {isBlocked
                  ? 'ההצבעה סגורה'
                  : !isAuthenticated
                    ? 'התחברו והשלימו'
                    : submitting
                      ? 'רושמים את הקול…'
                      : 'אשרו והצביעו'}
              </NewsButton>
              <button
                type="button"
                className={styles.backLink}
                onClick={() => setStage('choice')}
                disabled={submitting}
              >
                ↳ חזרה לבחירה
              </button>
            </div>
          </section>
        )}

        {/* ---- STEP 3 - רישום ---- */}
        {stage === 'receipt' && ballot && (
          <section className={styles.panel} aria-label="קבלה ורישום">
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              שלב 03 · רישום
            </span>
            <h2 className={styles.panelTitle}>
              הקול שלכם <span className={styles.red}>נרשם.</span>
            </h2>
            <p className={styles.lead}>
              {alreadyRecorded ? (
                <>
                  כבר הצבעתם בהצבעה הזו. זה הרישום הקיים שלכם: <strong>{recordedText}</strong>.
                </>
              ) : (
                <>
                  הרישום הושלם. בחרתם: <strong>{recordedText}</strong>.
                </>
              )}
            </p>

            <Receipt
              className={styles.receipt}
              kicker="קבלה · RECEIPT"
              title="רישום השתתפות"
              rows={[
                { label: 'עמדה', value: recordedText || '-' },
                { label: 'סטטוס', value: 'נרשם', strong: true },
                { label: 'מספר רישום', value: ballot.id },
              ]}
              footer={`הצבעה ${voteId} · ${recordedAt}`}
            />

            <p className={styles.trust}>הרישום נשמר בשרת ומשויך לתושב מאומת אחד.</p>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                className={styles.cta}
                onClick={() => onComplete(ballot.optionId)}
                trailing={<span aria-hidden>←</span>}
              >
                צפו בתוצאות
              </NewsButton>
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}
